import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { isBackupPath } from '../../../utils/trash-keys'
import { assertTrialNotExpired } from '../../utils/subscriptions'

// Excluir move o arquivo para a lixeira (restaurável por 30 dias). A exclusão definitiva direta
// só vale para versões antigas do aplicativo de backup (prefixo Backups/), usada na retenção.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ key?: string; permanent?: unknown }>(event)
  const key = String(body.key || '')
  const prefix = userPrefix(user.sub)

  if (!key.startsWith(prefix) || key.endsWith('/')) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot delete this file' })
  }

  const client = createS3Client()
  const bucket = requireS3Bucket()
  if (body.permanent === true && isBackupPath(key.slice(prefix.length))) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    return { ok: true, trashed: false }
  }

  await moveKeysToTrash(client, bucket, user.sub, [key])
  return { ok: true, trashed: true }
})
