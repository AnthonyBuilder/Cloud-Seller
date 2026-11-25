import Stripe from 'stripe'

function getStripeWebhookStatus(subscription: Stripe.Subscription) {
  if (subscription.status === 'active' || subscription.status === 'trialing') return 'active' as const
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') return 'past_due' as const
  if (subscription.status === 'canceled') return 'canceled' as const
  return 'incomplete' as const
}

export default defineEventHandler(async (event) => {
  const webhookSecret = getStripeWebhookSecret()

  const signature = getHeader(event, 'stripe-signature')
  if (!signature) {
    throw createError({ statusCode: 400, message: 'Missing Stripe signature' })
  }

  const payload = await readRawBody(event)
  if (!payload) {
    throw createError({ statusCode: 400, message: 'Missing Stripe webhook body' })
  }

  const secretKey = getStripeSecretKey()
  let stripeEvent: Stripe.Event
  try {
    stripeEvent = new Stripe(secretKey).webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? `Invalid Stripe webhook: ${error.message}` : 'Invalid Stripe webhook',
    })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId || session.client_reference_id
    const planId = session.metadata?.planId
    if (!userId || typeof planId !== 'string' || !findStoragePlan(planId)) {
      return { received: true }
    }

    const plan = findStoragePlan(planId)!
    if (session.payment_status !== 'paid') {
      await updateSubscriptionBilling(userId, {
        status: 'incomplete',
        planId: plan.id,
        paymentProvider: 'stripe',
        stripeCheckoutSessionId: session.id,
      })
      return { received: true }
    }

    await updateSubscriptionBilling(userId, {
      status: 'active',
      planId: plan.id,
      paymentProvider: 'stripe',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    })
  }

  if (
    stripeEvent.type === 'customer.subscription.updated'
    || stripeEvent.type === 'customer.subscription.deleted'
  ) {
    const subscription = stripeEvent.data.object as Stripe.Subscription
    const userId = subscription.metadata?.userId
    const planId = subscription.metadata?.planId
    if (!userId || typeof planId !== 'string' || !findStoragePlan(planId)) {
      return { received: true }
    }

    const plan = findStoragePlan(planId)!
    await updateSubscriptionBilling(userId, {
      status: getStripeWebhookStatus(subscription),
      planId: plan.id,
      paymentProvider: 'stripe',
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end || subscription.cancel_at || 0,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
  }

  return { received: true }
})
