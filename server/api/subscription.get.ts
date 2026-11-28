import { canStartFreeTrial, getStoragePlans, getStorageUsageSummary } from '../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const record = await getSubscription(user.sub)
  const usage = await getStorageUsageSummary(user.sub)

  if (!record) {
    return {
      plans: getStoragePlans(),
      subscription: null,
      usedBytes: usage.usedBytes,
      trashBytes: usage.trashBytes,
      usageByCategory: usage.usageByCategory,
      canStartFreeTrial: true,
    }
  }

  const plan = findStoragePlan(record.planId)
  if (!plan) {
    throw createError({ statusCode: 500, message: 'The saved storage plan is invalid' })
  }

  return {
    plans: getStoragePlans(),
    subscription: {
      planId: plan.id,
      name: plan.name,
      storage: plan.storage,
      quotaBytes: plan.quotaBytes,
      priceUsd: plan.priceUsd,
      priceBrl: plan.priceBrl,
      priceEur: plan.priceEur,
      paymentProvider: record.paymentProvider || (record.stripeSubscriptionId ? 'stripe' : undefined),
      status: getSubscriptionStatus(record),
      billingInterval: record.billingInterval || 'month',
      trialEndsAt: record.trialEndsAt,
    },
    usedBytes: usage.usedBytes,
    trashBytes: usage.trashBytes,
    usageByCategory: usage.usageByCategory,
    canStartFreeTrial: canStartFreeTrial(record),
  }
})
