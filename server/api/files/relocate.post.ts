import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { assertTrialNotExpired } from '../../utils/subscriptions'

function cleanName(value: unknown) {
  return String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/[^\p{L}\p{N}._ ()-]/gu, '-')
}

function copySource(bucket: string, key: string) {
  return `${bucket}/${key.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
}

function isMissingObject(error: unknown) {
  return error instanceof Error && ['NotFound', 'NoSuchKey'].includes(error.name)
}

async function ensureDestinationFolder(client: ReturnType<typeof createS3Client>, bucket: string, prefix: string) {
  if (!prefix) return
  const result = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: 1,
  }))
  if (!result.Contents?.length) {
    throw createError({ statusCode: 404, message: 'A pasta de destino não existe' })
  }
}

async function objectExists(client: ReturnType<typeof createS3Client>, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    if (isMissingObject(error)) return false
    throw error
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{
    kind?: unknown
    source?: unknown
    destinationFolder?: unknown
    newName?: unknown
  }>(event)
  const name = cleanName(body.newName)
  if (!name) {
    throw createError({ statusCode: 400, message: 'Informe um nome válido' })
  }

  const kind = body.kind
  if (kind !== 'file' && kind !== 'folder') {
    throw createError({ statusCode: 400, message: 'Tipo de item inválido' })
  }

  const client = createS3Client()
  const bucket = requireS3Bucket()
  const userPath = userPrefix(user.sub)
  const destinationFolder = safeFolder(body.destinationFolder)
  const destinationPrefix = `${userPath}${destinationFolder === '/' ? '' : destinationFolder.slice(1)}`
  await ensureDestinationFolder(client, bucket, destinationPrefix)

  if (kind === 'file') {
    const source = typeof body.source === 'string' ? body.source : ''
    if (!source.startsWith(userPath) || source.endsWith('/') || source === userPath) {
      throw createError({ statusCode: 403, message: 'Arquivo inválido ou fora da sua conta' })
    }

    const destinationKey = `${destinationPrefix}${name}`
    if (destinationKey === source) {
      throw createError({ statusCode: 400, message: 'O arquivo já está nessa pasta com esse nome' })
    }
    if (await objectExists(client, bucket, destinationKey)) {
      throw createError({ statusCode: 409, message: 'Já existe um arquivo com esse nome no destino' })
    }

    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource(bucket, source),
      Key: destinationKey,
    }))
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: source }))
    return { key: destinationKey, source }
  }

  const sourcePath = safeFolder(body.source)
  if (sourcePath === '/') {
    throw createError({ statusCode: 400, message: 'A pasta raiz não pode ser movida ou renomeada' })
  }

  const sourcePrefix = `${userPath}${sourcePath.slice(1)}`
  const destinationPath = `${destinationPrefix}${name}/`
  if (destinationPath === sourcePrefix || destinationPath.startsWith(sourcePrefix)) {
    throw createError({ statusCode: 400, message: 'Uma pasta não pode ser movida para dentro dela mesma' })
  }

  const destination = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: destinationPath,
    MaxKeys: 1,
  }))
  if (destination.Contents?.length) {
    throw createError({ statusCode: 409, message: 'Já existe uma pasta com esse nome no destino' })
  }

  const sourceKeys: string[] = []
  let continuationToken: string | undefined
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
    }))
    sourceKeys.push(...(response.Contents || []).flatMap(item => item.Key ? [item.Key] : []))
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  if (!sourceKeys.length) {
    throw createError({ statusCode: 404, message: 'A pasta não existe ou está vazia' })
  }

  const copiedKeys: string[] = []
  try {
    for (const sourceKey of sourceKeys) {
      const targetKey = `${destinationPath}${sourceKey.slice(sourcePrefix.length)}`
      await client.send(new CopyObjectCommand({
        Bucket: bucket,
        CopySource: copySource(bucket, sourceKey),
        Key: targetKey,
      }))
      copiedKeys.push(targetKey)
    }
  } catch (error) {
    try {
      for (let index = 0; index < copiedKeys.length; index += 1000) {
        await client.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: copiedKeys.slice(index, index + 1000).map(Key => ({ Key })), Quiet: true },
        }))
      }
    } catch (cleanupError) {
      console.error('Could not remove partial folder copies after relocation failed', cleanupError)
    }
    throw error
  }

  for (let index = 0; index < sourceKeys.length; index += 1000) {
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: sourceKeys.slice(index, index + 1000).map(Key => ({ Key })), Quiet: true },
    }))
    if (result.Errors?.length) {
      throw createError({
        statusCode: 502,
        message: 'A pasta foi copiada, mas alguns arquivos originais não foram removidos; atualize a lista antes de continuar',
      })
    }
  }

  return {
    path: destinationPath.slice(userPath.length),
    sourcePrefix,
    destinationPrefix: destinationPath,
  }
})
