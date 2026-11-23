import { S3Client } from '@aws-sdk/client-s3'

export function createS3Client() {
  const config = useRuntimeConfig()

  return new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint || undefined,
    forcePathStyle: Boolean(config.s3Endpoint),
    credentials: config.s3AccessKeyId && config.s3SecretAccessKey
      ? {
          accessKeyId: config.s3AccessKeyId,
          secretAccessKey: config.s3SecretAccessKey,
        }
      : undefined,
  })
}

export function requireS3Bucket() {
  const config = useRuntimeConfig()
  if (!config.s3Bucket) {
    throw createError({ statusCode: 500, statusMessage: 'S3_BUCKET is not configured' })
  }
  return String(config.s3Bucket)
}
