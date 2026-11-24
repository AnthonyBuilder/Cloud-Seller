import { PutObjectCommand } from '@aws-sdk/client-s3'
import { assertTrialNotExpired } from '../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ folder?: string; name?: string }>(event)
  const parent = safeFolder(body.folder)
  const name = String(body.name || '').trim().replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9._ ()-]/g, '-')

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'A valid folder name is required' })
  }

  const key = `${userPrefix(user.sub)}${parent === '/' ? '' : parent.slice(1)}${name}/`
  await createS3Client().send(new PutObjectCommand({
    Bucket: requireS3Bucket(),
    Key: key,
    Body: '',
  }))

  return { path: `${parent === '/' ? '/' : parent}${name}/` }
})
