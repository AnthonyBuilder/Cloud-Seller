export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ planId?: unknown }>(event)
  const plan = findStoragePlan(body.planId)

  if (!plan) {
    throw createError({ statusCode: 400, message: 'Choose a valid storage plan' })
  }

  const existing = await getSubscription(user.sub)
  if (existing) {
    throw createError({ statusCode: 409, message: 'A storage plan has already been selected' })
  }

  const usedBytes = await getStorageUsage(user.sub)
  if (usedBytes > plan.quotaBytes) {
    throw createError({ statusCode: 409, message: 'Existing files exceed this plan capacity' })
  }

  try {
    const subscription = await createActiveSubscription(user.sub, plan)
    return { subscription }
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw createError({ statusCode: 409, message: 'A storage plan has already been selected' })
    }
    throw error
  }
})
