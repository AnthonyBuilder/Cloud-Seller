import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ folder?: string; name?: string; mime?: string; size?: unknown }>(event)
  const folder = safeFolder(body.folder)
  const name = String(body.name || '').normalize('NFC').trim().replace(/^.*[\\/]/, '').replace(/[^\p{L}\p{N}._ ()-]/gu, '-')
  const size = body.size

  if (!name) {
    throw createError({ statusCode: 400, message: 'A valid file name is required' })
  }
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
    throw createError({ statusCode: 400, message: 'A valid file size is required' })
  }

  const subscription = await getSubscription(user.sub)
  if (!subscription) {
    throw createError({ statusCode: 403, message: 'Choose a storage plan before uploading files' })
  }
  const plan = findStoragePlan(subscription.planId)
  if (!plan) {
    throw createError({ statusCode: 500, message: 'The saved storage plan is invalid' })
  }
  if (getSubscriptionStatus(subscription) === 'expired') {
    throw createError({ statusCode: 403, message: 'Your trial has expired; renew your plan to upload files' })
  }

  const key = `${userPrefix(user.sub)}${folder === '/' ? '' : folder.slice(1)}${name}`
  const client = createS3Client()
  const bucket = requireS3Bucket()
  let existingSize = 0
  try {
    const existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    existingSize = existing.ContentLength || 0
  } catch (error) {
    if (!(error instanceof Error && error.name === 'NotFound')) throw error
  }

  const usedBytes = await getStorageUsage(user.sub)
  if (usedBytes - existingSize + size > plan.quotaBytes) {
    throw createError({ statusCode: 413, message: 'This file exceeds the remaining storage capacity' })
  }

  try {
    await reserveUpload(user.sub, key, size)
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw createError({ statusCode: 409, message: 'Finish the previous upload before starting another' })
    }
    throw error
  }

  let url: string
  try {
    url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: body.mime || 'application/octet-stream',
      ContentLength: size,
    }), {
      expiresIn: 300,
      signableHeaders: new Set(['content-length']),
    })
  } catch (error) {
    try {
      await releaseUpload(user.sub, key)
    } catch (releaseError) {
      console.error('Could not release the upload reservation after signing failed', releaseError)
    }
    throw error
  }

  return { url, key }
})
