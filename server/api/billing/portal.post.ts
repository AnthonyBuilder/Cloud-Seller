import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const subscription = await getSubscription(user.sub)
  if (!subscription?.stripeCustomerId) {
    throw createError({ statusCode: 409, message: 'There is no active Stripe customer for this account' })
  }

  const appUrl = (process.env.NUXT_PUBLIC_APP_URL || getHeader(event, 'origin') || 'http://localhost:3000').replace(/\/$/, '')
  const stripe = new Stripe(getStripeSecretKey())
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/subscription`,
  })

  return { url: session.url }
})
