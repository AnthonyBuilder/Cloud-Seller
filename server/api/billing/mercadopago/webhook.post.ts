import { getQuery } from 'h3'
import {
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoPreapproval,
  verifyMercadoPagoWebhook,
} from '../../../utils/mercadopago'
import type { MercadoPagoAuthorizedPayment, MercadoPagoPreapproval } from '../../../utils/mercadopago'
import { updateSubscriptionBilling } from '../../../utils/subscriptions'

type MercadoPagoNotification = {
  type?: string
  topic?: string
  data?: { id?: unknown }
}

function getSubscriptionStatus(status: MercadoPagoPreapproval['status']) {
  if (status === 'authorized') return 'active' as const
  if (status === 'paused') return 'past_due' as const
  if (status === 'cancelled') return 'canceled' as const
  return 'incomplete' as const
}

function isAuthorizedPayment(value: unknown): value is MercadoPagoAuthorizedPayment {
  return Boolean(
    value
    && typeof value === 'object'
    && 'preapproval_id' in value
    && 'status' in value,
  )
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const body = await readBody<MercadoPagoNotification>(event)
  const dataId = typeof query['data.id'] === 'string' ? query['data.id'] : ''
  if (!dataId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing Mercado Pago notification resource ID' })
  }
  verifyMercadoPagoWebhook(event, dataId)

  const topic = String(query.type || query.topic || body?.type || body?.topic || '')
  if (topic === 'subscription_preapproval') {
    const preapproval = await getMercadoPagoPreapproval(dataId)
    if (preapproval.id !== dataId || !preapproval.external_reference) return { received: true }

    const subscription = await getSubscription(preapproval.external_reference)
    if (
      !subscription
      || subscription.paymentProvider !== 'mercadopago'
      || (subscription.mercadoPagoPreapprovalId && subscription.mercadoPagoPreapprovalId !== preapproval.id)
      || (!subscription.mercadoPagoPreapprovalId && subscription.status !== 'incomplete')
    ) {
      return { received: true }
    }

    const status = getSubscriptionStatus(preapproval.status)
    await updateSubscriptionBilling(preapproval.external_reference, {
      status,
      planId: subscription.planId,
      paymentProvider: 'mercadopago',
      mercadoPagoPreapprovalId: status === 'canceled' ? '' : preapproval.id,
      mercadoPagoInitPoint: status === 'incomplete' ? subscription.mercadoPagoInitPoint : '',
      currentPeriodEnd: preapproval.next_payment_date ? Date.parse(preapproval.next_payment_date) : 0,
    })
    return { received: true }
  }

  if (topic === 'subscription_authorized_payment') {
    const payment = await getMercadoPagoAuthorizedPayment(dataId)
    if (!isAuthorizedPayment(payment) || !payment.external_reference) return { received: true }

    const subscription = await getSubscription(payment.external_reference)
    if (
      !subscription
      || subscription.paymentProvider !== 'mercadopago'
      || subscription.mercadoPagoPreapprovalId !== payment.preapproval_id
    ) {
      return { received: true }
    }

    const preapproval = await getMercadoPagoPreapproval(payment.preapproval_id)
    const paymentRejected = payment.payment?.status === 'rejected' || payment.status === 'recycling'
    const paid = payment.payment?.status === 'approved' && payment.status === 'processed'
    if (!paymentRejected && !paid) return { received: true }

    await updateSubscriptionBilling(payment.external_reference, {
      status: paymentRejected
        ? 'past_due'
        : preapproval.status === 'authorized'
          ? 'active'
          : getSubscriptionStatus(preapproval.status),
      planId: subscription.planId,
      paymentProvider: 'mercadopago',
      mercadoPagoPreapprovalId: preapproval.status === 'cancelled' ? '' : preapproval.id,
      mercadoPagoInitPoint: '',
      currentPeriodEnd: preapproval.next_payment_date ? Date.parse(preapproval.next_payment_date) : 0,
    })
  }

  return { received: true }
})
