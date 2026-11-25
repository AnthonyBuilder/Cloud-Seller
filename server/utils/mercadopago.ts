import { createHmac, timingSafeEqual } from 'node:crypto'
import { getHeader, getQuery, type H3Event } from 'h3'

const API_URL = 'https://api.mercadopago.com'

export type MercadoPagoPreapproval = {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string
  external_reference?: string
  init_point?: string
  next_payment_date?: string
}

export type MercadoPagoAuthorizedPayment = {
  id: number
  preapproval_id: string
  status: string
  summarized: string
  external_reference?: string
  payment?: {
    status?: string
  }
}

function getMercadoPagoSetting(name: 'MERCADOPAGO_ACCESS_TOKEN' | 'MERCADOPAGO_WEBHOOK_SECRET') {
  const config = useRuntimeConfig()
  const value = process.env[name]
    || (name === 'MERCADOPAGO_ACCESS_TOKEN' ? config.mercadoPagoAccessToken : config.mercadoPagoWebhookSecret)
  return String(value || '').trim()
}

export function getMercadoPagoAccessToken() {
  const accessToken = getMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Mercado Pago não está configurado. Defina MERCADOPAGO_ACCESS_TOKEN no ambiente do servidor.',
    })
  }
  return accessToken
}

export function getMercadoPagoWebhookSecret() {
  const secret = getMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET')
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Webhook do Mercado Pago não está configurado. Defina MERCADOPAGO_WEBHOOK_SECRET no servidor.',
    })
  }
  return secret
}

async function mercadoPagoRequest<T>(path: string, options?: { method?: 'POST' | 'PUT'; body?: object }) {
  return await $fetch<T>(`${API_URL}${path}`, {
    method: options?.method || 'GET',
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: options?.body,
  })
}

export function createMercadoPagoPreapproval(body: {
  reason: string
  external_reference: string
  payer_email: string
  back_url: string
  notification_url: string
  auto_recurring: {
    frequency: 1
    frequency_type: 'months'
    transaction_amount: number
    currency_id: 'BRL'
  }
}) {
  return mercadoPagoRequest<MercadoPagoPreapproval>('/preapproval', {
    method: 'POST',
    body: { ...body, status: 'pending' },
  })
}

export function getMercadoPagoPreapproval(id: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${encodeURIComponent(id)}`)
}

export function getMercadoPagoAuthorizedPayment(id: string) {
  return mercadoPagoRequest<MercadoPagoAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`)
}

export function cancelMercadoPagoPreapproval(id: string) {
  return mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  })
}

export function verifyMercadoPagoWebhook(event: H3Event, dataId: string) {
  const secret = getMercadoPagoWebhookSecret()
  const signature = getHeader(event, 'x-signature')
  const requestId = getHeader(event, 'x-request-id')
  const query = getQuery(event)

  if (!signature || !requestId || !dataId || query['data.id'] !== dataId) {
    throw createError({ statusCode: 401, statusMessage: 'Assinatura do webhook do Mercado Pago ausente ou inválida.' })
  }

  const parts = new Map(
    signature.split(',').map((part) => {
      const separator = part.indexOf('=')
      return separator < 0
        ? ['', '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    }),
  )
  const timestamp = parts.get('ts')
  const receivedHex = parts.get('v1')
  if (!timestamp || !receivedHex || !/^[0-9a-f]+$/i.test(receivedHex)) {
    throw createError({ statusCode: 401, statusMessage: 'Assinatura do webhook do Mercado Pago inválida.' })
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  const received = Buffer.from(receivedHex, 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw createError({ statusCode: 401, statusMessage: 'Assinatura do webhook do Mercado Pago inválida.' })
  }
}
