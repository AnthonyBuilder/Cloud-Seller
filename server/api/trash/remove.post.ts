import { assertTrialNotExpired } from '../../utils/subscriptions'
import { parseTrashKey } from '../../../utils/trash-keys'

// Exclusão definitiva (um ou mais itens, ou esvaziar tudo).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ keys?: unknown; all?: unknown }>(event) || {}
  const client = createS3Client()
  const bucket = requireS3Bucket()

  const requested = body.all === true
    ? (await listTrashItems(client, bucket, user.sub)).map(item => item.key)
    : Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === 'string').slice(0, 1000) : []
  const keys = requested.filter(key => parseTrashKey(user.sub, key))
  if (!keys.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum item selecionado' })
  }

  await deleteKeysPermanently(client, bucket, keys)
  return { removed: keys.length }
})
