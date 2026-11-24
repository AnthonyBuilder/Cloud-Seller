export function getStripeSecretKey() {
  const config = useRuntimeConfig()
  const secretKey = (process.env.STRIPE_SECRET_KEY || config.stripeSecretKey || '').trim()
  if (!secretKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Stripe não está configurado. Defina STRIPE_SECRET_KEY no ambiente do servidor.',
    })
  }
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Use a chave secreta padrão Stripe com prefixo sk_test_ ou sk_live_; chaves pk_ e rk_ não são aceitas.',
    })
  }
  return secretKey
}

export function getStripeWebhookSecret() {
  const config = useRuntimeConfig()
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || config.stripeWebhookSecret || '').trim()
  if (!webhookSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Webhook do Stripe não está configurado. Defina STRIPE_WEBHOOK_SECRET no servidor.',
    })
  }
  if (!webhookSecret.startsWith('whsec_')) {
    throw createError({
      statusCode: 503,
      statusMessage: 'STRIPE_WEBHOOK_SECRET deve ser o segredo de assinatura do endpoint (whsec_...).',
    })
  }
  return webhookSecret
}
