import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { assertTrialNotExpired } from '../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await assertTrialNotExpired(user.sub)
  const body = await readBody<{ path?: string }>(event)
  const path = safeFolder(body.path)
  const prefix = `${userPrefix(user.sub)}${path === '/' ? '' : path.slice(1)}`

  if (path === '/') {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete the root folder' })
  }

  let continuationToken: string | undefined
  do {
    const response = await createS3Client().send(new ListObjectsV2Command({
      Bucket: requireS3Bucket(),
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }))
    for (const item of response.Contents || []) {
      await createS3Client().send(new DeleteObjectCommand({
        Bucket: requireS3Bucket(),
        Key: item.Key!,
      }))
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return { ok: true }
})
