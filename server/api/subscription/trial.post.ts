import { canStartFreeTrial } from '../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const existing = await getSubscription(user.sub)
  if (!canStartFreeTrial(existing)) {
    throw createError({ statusCode: 409, message: 'Esta conta não está elegível para iniciar o período gratuito' })
  }

  const plan = findStoragePlan(FREE_TRIAL_PLAN_ID)
  if (!plan) {
    throw createError({ statusCode: 500, message: 'O plano gratuito não está configurado' })
  }

  const usedBytes = await getStorageUsage(user.sub)
  if (usedBytes > plan.quotaBytes) {
    throw createError({ statusCode: 409, message: 'Os arquivos existentes excedem a capacidade do teste gratuito' })
  }

  try {
    const subscription = await createFreeTrialSubscription(user.sub, plan, existing)
    return { subscription }
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw createError({ statusCode: 409, message: 'Esta conta não está elegível para iniciar o período gratuito' })
    }
    throw error
  }
})
