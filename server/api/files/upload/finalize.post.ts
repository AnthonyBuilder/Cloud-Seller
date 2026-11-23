import { HeadObjectCommand } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ key?: unknown; uploaded?: unknown }>(event)
  const prefix = userPrefix(user.sub)

  if (typeof body.key !== 'string' || !body.key.startsWith(prefix)) {
    throw createError({ statusCode: 400, message: 'Invalid upload key' })
  }

  const subscription = await getSubscription(user.sub)
  if (!subscription || subscription.pendingUploadKey !== body.key) {
    throw createError({ statusCode: 409, message: 'The upload reservation is no longer active' })
  }

  if (body.uploaded === true) {
    const object = await createS3Client().send(new HeadObjectCommand({
      Bucket: requireS3Bucket(),
      Key: body.key,
    }))
    if (object.ContentLength !== subscription.pendingUploadBytes) {
      throw createError({ statusCode: 400, message: 'The uploaded file size does not match the reservation' })
    }
  } else if (body.uploaded !== false) {
    throw createError({ statusCode: 400, message: 'Upload completion status is required' })
  }

  try {
    await releaseUpload(user.sub, body.key)
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw createError({ statusCode: 409, message: 'The upload reservation has changed' })
    }
    throw error
  }

  return { ok: true }
})
