import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const key = String(query.key || '')
  const prefix = userPrefix(user.sub)

  if (!key.startsWith(prefix)) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot access this file' })
  }

  const url = await getSignedUrl(createS3Client(), new GetObjectCommand({
    Bucket: requireS3Bucket(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${key.split('/').pop()?.replace(/"/g, '')}"`,
  }), { expiresIn: 300 })

  return { url }
})
