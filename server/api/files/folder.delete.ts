import { isBackupPath } from '../../../utils/trash-keys'
import { assertTrialNotExpired } from '../../utils/subscriptions'

// Excluir uma pasta move todo o conteúdo para a lixeira. A exclusão definitiva direta
// só vale para pastas dentro de Backups/ (retenção do aplicativo de backup).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ path?: string; permanent?: unknown }>(event)
  const path = safeFolder(body.path)
  const prefix = `${userPrefix(user.sub)}${path === '/' ? '' : path.slice(1)}`

  if (path === '/') {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete the root folder' })
  }

  const client = createS3Client()
  const bucket = requireS3Bucket()
  const keys = (await listAllKeys(client, bucket, prefix)).map(item => item.key)

  if (body.permanent === true && isBackupPath(path)) {
    await deleteKeysPermanently(client, bucket, keys)
    return { ok: true, trashed: false, count: keys.length }
  }

  await moveKeysToTrash(client, bucket, user.sub, keys)
  return { ok: true, trashed: true, count: keys.length }
})
