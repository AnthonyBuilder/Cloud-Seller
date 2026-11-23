import { S3Client } from '@aws-sdk/client-s3'

export function createS3Client() {
  const config = useRuntimeConfig()
  const region = process.env.S3_REGION || config.s3Region
  const endpoint = process.env.S3_ENDPOINT || config.s3Endpoint
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || config.s3AccessKeyId
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || config.s3SecretAccessKey

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
  })
}

export function requireS3Bucket() {
  const config = useRuntimeConfig()
  const bucket = process.env.S3_BUCKET || config.s3Bucket
  if (!bucket) {
    throw createError({ statusCode: 500, statusMessage: 'S3_BUCKET is not configured' })
  }
  return String(bucket)
}
