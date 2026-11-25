import { cancelMercadoPagoPreapproval } from '../../../utils/mercadopago'
import { updateSubscriptionBilling } from '../../../utils/subscriptions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const subscription = await getSubscription(user.sub)
  if (
    !subscription
    || subscription.paymentProvider !== 'mercadopago'
    || !subscription.mercadoPagoPreapprovalId
    || (subscription.status !== 'active' && subscription.status !== 'past_due')
  ) {
    throw createError({ statusCode: 409, message: 'There is no active Mercado Pago subscription to cancel' })
  }

  const preapproval = await cancelMercadoPagoPreapproval(subscription.mercadoPagoPreapprovalId)
  if (preapproval.status !== 'cancelled') {
    throw createError({ statusCode: 502, message: 'Mercado Pago did not confirm the subscription cancellation' })
  }

  await updateSubscriptionBilling(user.sub, {
    status: 'canceled',
    planId: subscription.planId,
    paymentProvider: 'mercadopago',
    mercadoPagoPreapprovalId: '',
    mercadoPagoInitPoint: '',
  })

  return { status: 'canceled' }
})
