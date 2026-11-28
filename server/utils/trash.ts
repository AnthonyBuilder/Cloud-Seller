import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { buildTrashKey, parseTrashKey, restoredName, trashPrefixFor } from '../../utils/trash-keys'

type S3 = ReturnType<typeof createS3Client>

function isAccessDenied(error: unknown) {
  if (!(error instanceof Error)) return false
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
  return error.name === 'AccessDenied' || status === 403
}

// Se as credenciais do storage ainda não têm permissão no prefixo trash/, devolvemos um aviso claro
// em vez de um erro 500 genérico. Nunca caímos para exclusão definitiva por conta própria.
async function withTrashAccess<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (isAccessDenied(error)) {
      console.error('[trash] AccessDenied no prefixo trash/: ajuste a política IAM (docs/iam-trash-policy.json)')
      throw createError({
        statusCode: 503,
        message: 'A lixeira ainda não está disponível neste serviço. Tente novamente mais tarde.',
      })
    }
    throw error
  }
}

// Uso da lixeira para o cálculo da cota. Se não der para ler (permissão), conta 0 e registra o problema,
// para não derrubar o painel nem os uploads.
export async function getTrashBytes(client: S3, bucket: string, sub: string) {
  try {
    return await sumPrefixBytes(client, bucket, trashPrefixFor(sub))
  } catch (error) {
    console.error('[trash] não foi possível calcular o uso da lixeira:', error instanceof Error ? error.name : 'erro')
    return 0
  }
}

function copySource(bucket: string, key: string) {
  return `${bucket}/${key.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
}

async function inBatches<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker))
  }
}

export async function listAllKeys(client: S3, bucket: string, prefix: string) {
  const objects: { key: string; size: number; modified?: Date }[] = []
  let continuationToken: string | undefined
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    for (const item of response.Contents || []) {
      if (item.Key) objects.push({ key: item.Key, size: item.Size || 0, modified: item.LastModified })
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)
  return objects
}

export async function sumPrefixBytes(client: S3, bucket: string, prefix: string) {
  return (await listAllKeys(client, bucket, prefix)).reduce((total, item) => total + item.size, 0)
}

// Move arquivos para a lixeira (copiar + apagar). Marcadores de pasta vazios são apagados direto.
export async function moveKeysToTrash(client: S3, bucket: string, sub: string, keys: string[]) {
  const deletedAt = Date.now()
  await withTrashAccess(() => inBatches(keys, 8, async (key) => {
    if (key.endsWith('/')) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      return
    }
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource(bucket, key),
      Key: buildTrashKey(sub, key, deletedAt),
    }))
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }))
}

export async function deleteKeysPermanently(client: S3, bucket: string, keys: string[]) {
  for (let index = 0; index < keys.length; index += 1000) {
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.slice(index, index + 1000).map(Key => ({ Key })), Quiet: true },
    }))
  }
}

async function exists(client: S3, bucket: string, key: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (error) {
    if (error instanceof Error && ['NotFound', 'NoSuchKey'].includes(error.name)) return false
    throw error
  }
}

export async function listTrashItems(client: S3, bucket: string, sub: string) {
  const objects = await withTrashAccess(() => listAllKeys(client, bucket, trashPrefixFor(sub)))
  const items = objects
    .flatMap((object) => {
      const parsed = parseTrashKey(sub, object.key)
      return parsed ? [{ ...parsed, key: object.key, size: object.size }] : []
    })
  return items.sort((a, b) => b.deletedAt - a.deletedAt)
}

// Restaura para o caminho original; se já existir um arquivo igual, restaura com o sufixo "(restaurado AAAA-MM-DD)".
export async function restoreTrashKeys(client: S3, bucket: string, sub: string, keys: string[]) {
  return withTrashAccess(() => restoreTrashKeysUnchecked(client, bucket, sub, keys))
}

async function restoreTrashKeysUnchecked(client: S3, bucket: string, sub: string, keys: string[]) {
  let restored = 0
  for (const key of keys) {
    const parsed = parseTrashKey(sub, key)
    if (!parsed) continue
    let target = parsed.originalKey
    if (await exists(client, bucket, target)) {
      const slash = target.lastIndexOf('/')
      target = `${target.slice(0, slash + 1)}${restoredName(target.slice(slash + 1), new Date())}`
    }
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource(bucket, key),
      Key: target,
    }))
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    restored++
  }
  return restored
}
