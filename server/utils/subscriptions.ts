import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getFileCategory, type FileCategory } from '../../utils/file-types'
import { buildPlanCatalog, resolvePriceBook, type BillingInterval, type CatalogPlan } from '../../utils/plan-catalog'

// Preços e cotas ficam em utils/plan-catalog.ts (fonte única, também usada na home).
// O livro de preços ativo vem de NUXT_PUBLIC_PRICE_BOOK (o mesmo valor que a home usa).
export function getStoragePlans() {
  const config = useRuntimeConfig()
  return buildPlanCatalog(resolvePriceBook(process.env.NUXT_PUBLIC_PRICE_BOOK || config.public.priceBook))
}

export const FREE_TRIAL_PLAN_ID = 'essencial'
export const FREE_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000

export type StoragePlan = CatalogPlan
export type PaymentProvider = 'stripe' | 'mercadopago'
export type SubscriptionRecord = {
  userId: string
  planId: StoragePlan['id']
  status: 'active' | 'incomplete' | 'past_due' | 'canceled' | 'trial'
  trialEndsAt?: number
  paymentProvider?: PaymentProvider
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripeCheckoutSessionId?: string
  mercadoPagoPreapprovalId?: string
  mercadoPagoInitPoint?: string
  currentPeriodEnd?: number
  cancelAtPeriodEnd?: boolean
  billingInterval?: BillingInterval
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
    ? getStoragePlans().find(plan => plan.id === planId)
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
    && !subscription.mercadoPagoPreapprovalId
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

  // Itens na lixeira ocupam espaço do plano até serem excluídos (30 dias).
  return usedBytes + await getTrashBytes(client, bucket, userId)
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

  const trashBytes = await getTrashBytes(client, bucket, userId)
  return { usedBytes: usedBytes + trashBytes, trashBytes, usageByCategory }
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
      ConditionExpression: 'attribute_not_exists(trialEndsAt) AND (attribute_not_exists(stripeSubscriptionId) OR stripeSubscriptionId = :empty) AND (attribute_not_exists(mercadoPagoPreapprovalId) OR mercadoPagoPreapprovalId = :empty) AND (#status = :incomplete OR #status = :canceled)',
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
    paymentProvider?: PaymentProvider
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    stripeCheckoutSessionId?: string
    mercadoPagoPreapprovalId?: string
    mercadoPagoInitPoint?: string
    currentPeriodEnd?: number
    cancelAtPeriodEnd?: boolean
    // Só é gravado quando informado (checkout); os webhooks preservam o valor existente.
    billingInterval?: BillingInterval
  },
) {
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: `SET #status = :status, planId = :planId, paymentProvider = :paymentProvider, stripeCustomerId = :customerId, stripeSubscriptionId = :subscriptionId, stripeCheckoutSessionId = :checkoutSessionId, mercadoPagoPreapprovalId = :preapprovalId, mercadoPagoInitPoint = :initPoint, currentPeriodEnd = :periodEnd, cancelAtPeriodEnd = :cancelAtPeriodEnd${values.billingInterval ? ', billingInterval = :billingInterval' : ''}`,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ...(values.billingInterval ? { ':billingInterval': values.billingInterval } : {}),
      ':status': values.status,
      ':planId': values.planId,
      ':paymentProvider': values.paymentProvider || 'stripe',
      ':customerId': values.stripeCustomerId || '',
      ':subscriptionId': values.stripeSubscriptionId || '',
      ':checkoutSessionId': values.stripeCheckoutSessionId || '',
      ':preapprovalId': values.mercadoPagoPreapprovalId || '',
      ':initPoint': values.mercadoPagoInitPoint || '',
      ':periodEnd': values.currentPeriodEnd || 0,
      ':cancelAtPeriodEnd': Boolean(values.cancelAtPeriodEnd),
    },
  }))
}

export async function saveStripeCheckoutSession(userId: string, sessionId: string) {
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'SET stripeCheckoutSessionId = :sessionId',
    ConditionExpression: 'paymentProvider = :provider AND (#status = :incomplete OR #status = :active)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':sessionId': sessionId,
      ':provider': 'stripe',
      ':incomplete': 'incomplete',
      ':active': 'active',
    },
  }))
}

export async function saveMercadoPagoCheckout(
  userId: string,
  preapprovalId: string,
  initPoint: string,
) {
  await getDocumentClient().send(new UpdateCommand({
    TableName: getTableName(),
    Key: { userId },
    UpdateExpression: 'SET mercadoPagoPreapprovalId = :preapprovalId, mercadoPagoInitPoint = :initPoint',
    ConditionExpression: 'paymentProvider = :provider AND (#status = :incomplete OR #status = :active)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':preapprovalId': preapprovalId,
      ':initPoint': initPoint,
      ':provider': 'mercadopago',
      ':incomplete': 'incomplete',
      ':active': 'active',
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

// Prova de aceite dos Termos e da Política de Privacidade. Fica na mesma tabela, com uma
// chave própria ("consent#<sub>") que não colide com os registros de assinatura.
export async function recordTermsAcceptance(sub: string, email: string, termsVersion: string) {
  await getDocumentClient().send(new PutCommand({
    TableName: getTableName(),
    Item: {
      userId: `consent#${sub}`,
      email,
      termsVersion,
      acceptedAt: new Date().toISOString(),
    },
  }))
}
