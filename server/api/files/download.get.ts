import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const PREVIEW_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const key = String(query.key || '')
  const prefix = userPrefix(user.sub)

  if (!key.startsWith(prefix)) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot access this file' })
  }

  const client = createS3Client()
  const bucket = requireS3Bucket()
  const preview = query.preview === 'true'
  let contentType = ''

  if (preview) {
    const extension = key.split('.').pop()?.toLowerCase() || ''
    contentType = PREVIEW_CONTENT_TYPES[extension] || ''
    if (!contentType) {
      throw createError({ statusCode: 415, statusMessage: 'This file type cannot be previewed safely' })
    }
  }

  const url = await getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: preview
      ? 'inline'
      : `attachment; filename="${key.split('/').pop()?.replace(/"/g, '')}"`,
    ...(preview ? { ResponseContentType: contentType } : {}),
  }), { expiresIn: 300 })

  return preview ? { url, contentType } : { url }
})
