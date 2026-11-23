import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export const STORAGE_PLANS = [
  { id: 'essencial', name: 'Essencial', storage: '100 GB', quotaBytes: 100_000_000_000 },
  { id: 'pro', name: 'Pro', storage: '1 TB', quotaBytes: 1_000_000_000_000 },
  { id: 'familia', name: 'Família', storage: '2 TB', quotaBytes: 2_000_000_000_000 },
] as const

export const TRIAL_DURATION_DAYS = 5

export type StoragePlan = typeof STORAGE_PLANS[number]
export type SubscriptionRecord = {
  userId: string
  planId: StoragePlan['id']
  status: 'trial' | 'active' | 'expired'
  trialStartedAt: number
  trialEndsAt: number
  pendingUploadKey?: string
  pendingUploadBytes?: number
  pendingUploadExpiresAt?: number
}

function getTableName() {
  const config = useRuntimeConfig()
  const tableName = process.env.DYNAMODB_TABLE || config.dynamodbTable
  if (!tableName) {
    throw createError({ statusCode: 503, message: 'Subscription storage is not configured' })
  }
  return String(tableName)
}

function getDocumentClient() {
  return DynamoDBDocumentClient.from(new DynamoDBClient({
    region: process.env.DYNAMODB_REGION || getAwsRegion(),
    credentials: getAwsCredentials(),
  }))
}

export function findStoragePlan(planId: unknown): StoragePlan | undefined {
  return typeof planId === 'string'
    ? STORAGE_PLANS.find(plan => plan.id === planId)
    : undefined
}

export function isConditionalCheckFailed(error: unknown) {
  return error instanceof ConditionalCheckFailedException
}

export async function getSubscription(userId: string) {
  const response = await getDocumentClient().send(new GetCommand({
    TableName: getTableName(),
    Key: { userId },
    ConsistentRead: true,
  }))
  return response.Item as SubscriptionRecord | undefined
}

export function getSubscriptionStatus(subscription: SubscriptionRecord) {
  if (subscription.status === 'trial' && Date.now() >= subscription.trialEndsAt) {
    return 'expired' as const
  }
  return subscription.status
}

export async function getStorageUsage(userId: string) {
  const client = createS3Client()
  const bucket = requireS3Bucket()
  let continuationToken: string | undefined
  let usedBytes = 0

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: userPrefix(userId),
      ContinuationToken: continuationToken,
    }))
    for (const object of response.Contents || []) {
      usedBytes += object.Size || 0
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return usedBytes
}

export async function createTrialSubscription(userId: string, plan: StoragePlan) {
  const now = Date.now()
  const item: SubscriptionRecord = {
    userId,
    planId: plan.id,
    status: 'trial',
    trialStartedAt: now,
    trialEndsAt: now + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
  }

  await getDocumentClient().send(new PutCommand({
    TableName: getTableName(),
    Item: item,
    ConditionExpression: 'attribute_not_exists(userId)',
  }))
  return item
}

export async function reserveUpload(userId: string, key: string, size: number) {
  const now = Date.now()
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'SET pendingUploadKey = :key, pendingUploadBytes = :size, pendingUploadExpiresAt = :expires',
    ConditionExpression: 'attribute_not_exists(pendingUploadExpiresAt) OR pendingUploadExpiresAt <= :now',
    ExpressionAttributeValues: {
      ':key': key,
      ':size': size,
      ':now': now,
      ':expires': now + 330_000,
    },
  }))
}

export async function releaseUpload(userId: string, key: string) {
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'REMOVE pendingUploadKey, pendingUploadBytes, pendingUploadExpiresAt',
    ConditionExpression: 'pendingUploadKey = :key',
    ExpressionAttributeValues: { ':key': key },
  }))
}

export async function extendUploadReservation(userId: string, key: string) {
  const now = Date.now()
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'SET pendingUploadExpiresAt = :expires',
    ConditionExpression: 'pendingUploadKey = :key AND pendingUploadExpiresAt > :now',
    ExpressionAttributeValues: {
      ':key': key,
      ':now': now,
      ':expires': now + 330_000,
    },
  }))
}
