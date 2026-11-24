import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ planId?: unknown }>(event)
  const plan = findStoragePlan(body.planId)
  if (!plan) {
    throw createError({ statusCode: 400, message: 'Choose a valid storage plan' })
  }

  const secretKey = getStripeSecretKey()
  const existing = await getSubscription(user.sub)
  if (existing && getSubscriptionStatus(existing) === 'active') {
    throw createError({ statusCode: 409, message: 'This account already has an active paid plan' })
  }
  if (existing && getSubscriptionStatus(existing) === 'past_due') {
    throw createError({ statusCode: 409, message: 'Update the existing payment method in the Stripe billing portal' })
  }

  const usedBytes = await getStorageUsage(user.sub)
  if (usedBytes > plan.quotaBytes) {
    throw createError({ statusCode: 409, message: 'Existing files exceed this plan capacity' })
  }

  if (!existing) {
    await createActiveSubscription(user.sub, plan)
  }

  const appUrl = (process.env.NUXT_PUBLIC_APP_URL || getHeader(event, 'origin') || 'http://localhost:3000').replace(/\/$/, '')
  const stripe = new Stripe(secretKey)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: user.sub,
    ...(existing?.stripeCustomerId
      ? { customer: existing.stripeCustomerId }
      : { customer_email: user.email || undefined }),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: plan.priceCents,
        recurring: { interval: 'month' },
        product_data: {
          name: `Cloud Seller ${plan.name}`,
          description: `${plan.storage} of private cloud storage`,
        },
      },
    }],
    metadata: { userId: user.sub, planId: plan.id },
    subscription_data: { metadata: { userId: user.sub, planId: plan.id } },
    success_url: `${appUrl}/payment?checkout=success&plan=${encodeURIComponent(plan.id)}`,
    cancel_url: `${appUrl}/payment?checkout=cancelled&plan=${encodeURIComponent(plan.id)}`,
  })

  if (!session.url) {
    throw createError({ statusCode: 500, message: 'Stripe did not return a checkout URL' })
  }
  return { url: session.url }
})
