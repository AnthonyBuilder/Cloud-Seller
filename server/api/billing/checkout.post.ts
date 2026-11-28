import Stripe from 'stripe'
import { enabledCurrencies, isCurrency, providerForCurrency } from '../../../utils/currency'
import { getPlanPriceCents, isBillingInterval } from '../../../utils/plan-catalog'
import { createMercadoPagoPreapproval } from '../../utils/mercadopago'
import type { PaymentProvider } from '../../utils/subscriptions'
import { saveMercadoPagoCheckout, saveStripeCheckoutSession } from '../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ planId?: unknown; currency?: unknown; interval?: unknown; provider?: unknown }>(event)
  const plan = findStoragePlan(body.planId)
  if (!plan) {
    throw createError({ statusCode: 400, message: 'Choose a valid storage plan' })
  }

  // A moeda define o meio de pagamento: BRL -> Mercado Pago; USD/EUR -> Stripe.
  // Clientes antigos que ainda enviam apenas "provider" continuam funcionando (mercadopago=BRL, stripe=USD).
  const config = useRuntimeConfig()
  const allowedCurrencies = enabledCurrencies(String(config.public.enableEur) === 'true')
  const requestedCurrency = body.currency
    ?? (body.provider === 'mercadopago' ? 'BRL' : 'USD')
  if (!isCurrency(requestedCurrency) || !allowedCurrencies.includes(requestedCurrency)) {
    throw createError({ statusCode: 400, message: 'Choose a valid currency' })
  }
  const currency = requestedCurrency
  const provider: PaymentProvider = providerForCurrency(currency)
  const interval = body.interval === undefined ? 'month' : body.interval
  if (!isBillingInterval(interval)) {
    throw createError({ statusCode: 400, message: 'Choose a valid billing interval' })
  }
  const priceCents = getPlanPriceCents(plan, currency, interval)
  const existing = await getSubscription(user.sub)
  if (existing && getSubscriptionStatus(existing) === 'active') {
    throw createError({ statusCode: 409, message: 'This account already has an active paid plan' })
  }
  if (existing && getSubscriptionStatus(existing) === 'past_due') {
    throw createError({ statusCode: 409, message: 'Resolve the existing subscription before starting another checkout' })
  }
  if (
    existing
    && getSubscriptionStatus(existing) === 'incomplete'
    && existing.paymentProvider
    && existing.paymentProvider !== provider
  ) {
    throw createError({ statusCode: 409, message: 'Continue the payment with the provider selected for this pending checkout' })
  }
  if (
    existing
    && getSubscriptionStatus(existing) === 'incomplete'
    && existing.planId !== plan.id
  ) {
    throw createError({ statusCode: 409, message: 'Continue the selected plan before choosing another one' })
  }

  const usedBytes = await getStorageUsage(user.sub)
  if (usedBytes > plan.quotaBytes) {
    throw createError({ statusCode: 409, message: 'Existing files exceed this plan capacity' })
  }

  if (!existing) {
    await createActiveSubscription(user.sub, plan)
  }

  const appUrl = (process.env.NUXT_PUBLIC_APP_URL || getHeader(event, 'origin') || 'http://localhost:3000').replace(/\/$/, '')
  if (provider === 'mercadopago') {
    const payerEmail = user.email?.trim()
    if (!payerEmail) {
      throw createError({ statusCode: 422, message: 'An account email is required for Mercado Pago subscriptions' })
    }

    if (
      existing?.paymentProvider === 'mercadopago'
      && existing.status === 'incomplete'
      && existing.mercadoPagoInitPoint
      && (existing.billingInterval || 'month') === interval
    ) {
      return { url: existing.mercadoPagoInitPoint }
    }

    await updateSubscriptionBilling(user.sub, {
      status: 'incomplete',
      planId: plan.id,
      paymentProvider: 'mercadopago',
      billingInterval: interval,
    })
    const preapproval = await createMercadoPagoPreapproval({
      reason: `Cloud Seller ${plan.name} - ${plan.storage}${interval === 'year' ? ' (anual)' : ''}`,
      external_reference: user.sub,
      payer_email: payerEmail,
      back_url: `${appUrl}/payment?provider=mercadopago&plan=${encodeURIComponent(plan.id)}&interval=${interval}`,
      notification_url: `${appUrl}/api/billing/mercadopago/webhook`,
      auto_recurring: {
        frequency: interval === 'year' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: priceCents / 100,
        currency_id: 'BRL',
      },
    })

    if (!preapproval.id || !preapproval.init_point) {
      throw createError({ statusCode: 502, message: 'Mercado Pago did not return a subscription checkout URL' })
    }

    await saveMercadoPagoCheckout(user.sub, preapproval.id, preapproval.init_point)
    return { url: preapproval.init_point }
  }

  const secretKey = getStripeSecretKey()
  const stripe = new Stripe(secretKey)
  if (
    existing?.paymentProvider === 'stripe'
    && existing.status === 'incomplete'
    && existing.stripeCheckoutSessionId
    && (existing.billingInterval || 'month') === interval
  ) {
    const pendingSession = await stripe.checkout.sessions.retrieve(existing.stripeCheckoutSessionId)
    if (pendingSession.status === 'open' && pendingSession.url) {
      return { url: pendingSession.url }
    }
    if (pendingSession.status === 'complete') {
      throw createError({ statusCode: 409, message: 'Your payment is being confirmed; refresh the subscription status before trying again' })
    }
  }

  await updateSubscriptionBilling(user.sub, {
    status: 'incomplete',
    planId: plan.id,
    paymentProvider: 'stripe',
    stripeCustomerId: existing?.stripeCustomerId,
    billingInterval: interval,
  })
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: user.sub,
    ...(existing?.stripeCustomerId
      ? { customer: existing.stripeCustomerId }
      : { customer_email: user.email || undefined }),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: priceCents,
        recurring: { interval },
        product_data: {
          name: `Cloud Seller ${plan.name}${interval === 'year' ? ' (anual)' : ''}`,
          description: `${plan.storage} of private cloud storage`,
        },
      },
    }],
    metadata: { userId: user.sub, planId: plan.id, interval },
    subscription_data: { metadata: { userId: user.sub, planId: plan.id, interval } },
    success_url: `${appUrl}/payment?checkout=success&plan=${encodeURIComponent(plan.id)}&interval=${interval}`,
    cancel_url: `${appUrl}/payment?checkout=cancelled&plan=${encodeURIComponent(plan.id)}&interval=${interval}`,
  })

  if (!session.url) {
    throw createError({ statusCode: 500, message: 'Stripe did not return a checkout URL' })
  }
  await saveStripeCheckoutSession(user.sub, session.id)
  return { url: session.url }
})
