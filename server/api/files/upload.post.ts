import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ folder?: string; name?: string; mime?: string }>(event)
  const folder = safeFolder(body.folder)
  const name = String(body.name || '').normalize('NFC').trim().replace(/^.*[\\/]/, '').replace(/[^\p{L}\p{N}._ ()-]/gu, '-')

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'A valid file name is required' })
  }

  const key = `${userPrefix(user.sub)}${folder === '/' ? '' : folder.slice(1)}${name}`
  const url = await getSignedUrl(createS3Client(), new PutObjectCommand({
    Bucket: requireS3Bucket(),
    Key: key,
    ContentType: body.mime || 'application/octet-stream',
  }), { expiresIn: 300 })

  return { url, key }
})
