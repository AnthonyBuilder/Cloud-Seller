import { DeleteObjectCommand } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ key?: string }>(event)
  const key = String(body.key || '')
  const prefix = userPrefix(user.sub)

  if (!key.startsWith(prefix)) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot delete this file' })
  }

  await createS3Client().send(new DeleteObjectCommand({
    Bucket: requireS3Bucket(),
    Key: key,
  }))
  return { ok: true }
})
