export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const record = await getSubscription(user.sub)
  const usedBytes = await getStorageUsage(user.sub)

  if (!record) {
    return { plans: STORAGE_PLANS, subscription: null, usedBytes }
  }

  const plan = findStoragePlan(record.planId)
  if (!plan) {
    throw createError({ statusCode: 500, message: 'The saved storage plan is invalid' })
  }

  return {
    plans: STORAGE_PLANS,
    subscription: {
      planId: plan.id,
      name: plan.name,
      storage: plan.storage,
      quotaBytes: plan.quotaBytes,
      status: getSubscriptionStatus(record),
      trialStartedAt: record.trialStartedAt,
      trialEndsAt: record.trialEndsAt,
    },
    usedBytes,
  }
})
