import { S3Client } from '@aws-sdk/client-s3'

export function getAwsCredentials() {
  const config = useRuntimeConfig()
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || config.s3AccessKeyId
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || config.s3SecretAccessKey

  return accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined
}

export function getAwsRegion() {
  const config = useRuntimeConfig()
  return process.env.S3_REGION || config.s3Region || process.env.AWS_REGION || 'us-east-2'
}

export function createS3Client() {
  const config = useRuntimeConfig()
  const endpoint = process.env.S3_ENDPOINT || config.s3Endpoint

  return new S3Client({
    region: getAwsRegion(),
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: getAwsCredentials(),
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
