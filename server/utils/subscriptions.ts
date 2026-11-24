import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getFileCategory, type FileCategory } from '../../utils/file-types'

export const STORAGE_PLANS = [
  { id: 'essencial', name: 'Essencial', storage: '100 GB', quotaBytes: 100_000_000_000, priceUsd: 7.67, priceCents: 767 },
  { id: 'pro', name: 'Pro', storage: '500 GB', quotaBytes: 500_000_000_000, priceUsd: 38.33, priceCents: 3833 },
  { id: 'familia', name: 'Família', storage: '1 TB', quotaBytes: 1_000_000_000_000, priceUsd: 76.67, priceCents: 7667 },
] as const

export const FREE_TRIAL_PLAN_ID = 'essencial'
export const FREE_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000

export type StoragePlan = typeof STORAGE_PLANS[number]
export type SubscriptionRecord = {
  userId: string
  planId: StoragePlan['id']
  status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trial'
  trialEndsAt?: number
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  currentPeriodEnd?: number
  cancelAtPeriodEnd?: boolean
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

export function getSubscriptionStatus(subscription: SubscriptionRecord, now = Date.now()) {
  if (subscription.status !== 'trial') return subscription.status
  return subscription.trialEndsAt && subscription.trialEndsAt > now ? 'trial' : 'expired'
}

export async function assertTrialNotExpired(userId: string) {
  const subscription = await getSubscription(userId)
  if (subscription && getSubscriptionStatus(subscription) === 'expired') {
    throw createError({ statusCode: 403, message: 'O período gratuito terminou; o armazenamento está somente para leitura' })
  }
}

export function canStartFreeTrial(subscription?: SubscriptionRecord) {
  if (!subscription) return true
  return !subscription.trialEndsAt
    && !subscription.stripeSubscriptionId
    && (subscription.status === 'incomplete' || subscription.status === 'canceled')
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

export async function getStorageUsageSummary(userId: string) {
  const client = createS3Client()
  const bucket = requireS3Bucket()
  const usageByCategory: Record<FileCategory, { bytes: number; count: number }> = {
    image: { bytes: 0, count: 0 },
    video: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    pdf: { bytes: 0, count: 0 },
    spreadsheet: { bytes: 0, count: 0 },
    document: { bytes: 0, count: 0 },
    archive: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 },
  }
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
      if (!object.Key || object.Key.endsWith('/')) continue
      const category = getFileCategory(object.Key.split('/').pop() || object.Key)
      usageByCategory[category].bytes += object.Size || 0
      usageByCategory[category].count++
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return { usedBytes, usageByCategory }
}

export async function createActiveSubscription(userId: string, plan: StoragePlan) {
  const item: SubscriptionRecord = {
    userId,
    planId: plan.id,
    status: 'incomplete',
  }

  await getDocumentClient().send(new PutCommand({
    TableName: getTableName(),
    Item: item,
    ConditionExpression: 'attribute_not_exists(userId)',
  }))
  return item
}

export async function createFreeTrialSubscription(
  userId: string,
  plan: StoragePlan,
  existing?: SubscriptionRecord,
) {
  const trialEndsAt = Date.now() + FREE_TRIAL_DURATION_MS
  const item: SubscriptionRecord = { userId, planId: plan.id, status: 'trial', trialEndsAt }
  const client = getDocumentClient()
  const tableName = getTableName()

  if (existing) {
    await client.send(new UpdateCommand({
      TableName: tableName,
      Key: { userId },
      UpdateExpression: 'SET #status = :trial, planId = :planId, trialEndsAt = :trialEndsAt REMOVE currentPeriodEnd, cancelAtPeriodEnd',
      ConditionExpression: 'attribute_not_exists(trialEndsAt) AND (attribute_not_exists(stripeSubscriptionId) OR stripeSubscriptionId = :empty) AND (#status = :incomplete OR #status = :canceled)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':trial': 'trial',
        ':planId': plan.id,
        ':trialEndsAt': trialEndsAt,
        ':incomplete': 'incomplete',
        ':canceled': 'canceled',
        ':empty': '',
      },
    }))
    return item
  }

  await client.send(new PutCommand({
    TableName: tableName,
    Item: item,
    ConditionExpression: 'attribute_not_exists(userId)',
  }))
  return item
}

export async function updateSubscriptionBilling(
  userId: string,
  values: {
    status: SubscriptionRecord['status']
    planId: StoragePlan['id']
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    currentPeriodEnd?: number
    cancelAtPeriodEnd?: boolean
  },
) {
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'SET #status = :status, planId = :planId, stripeCustomerId = :customerId, stripeSubscriptionId = :subscriptionId, currentPeriodEnd = :periodEnd, cancelAtPeriodEnd = :cancelAtPeriodEnd',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': values.status,
      ':planId': values.planId,
      ':customerId': values.stripeCustomerId || '',
      ':subscriptionId': values.stripeSubscriptionId || '',
      ':periodEnd': values.currentPeriodEnd || 0,
      ':cancelAtPeriodEnd': Boolean(values.cancelAtPeriodEnd),
    },
  }))
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
