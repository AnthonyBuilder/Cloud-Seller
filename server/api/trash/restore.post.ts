import { assertTrialNotExpired } from '../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ keys?: unknown; all?: unknown }>(event) || {}
  const client = createS3Client()
  const bucket = requireS3Bucket()

  const keys = body.all === true
    ? (await listTrashItems(client, bucket, user.sub)).map(item => item.key)
    : Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === 'string').slice(0, 500) : []
  if (!keys.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum item selecionado' })
  }

  return { restored: await restoreTrashKeys(client, bucket, user.sub, keys) }
})
