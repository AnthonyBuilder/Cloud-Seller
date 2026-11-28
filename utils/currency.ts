import type { Currency } from './plan-catalog'

export type PaymentProviderName = 'stripe' | 'mercadopago'

const EURO_COUNTRIES = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
])

export function isCurrency(value: unknown): value is Currency {
  return value === 'BRL' || value === 'USD' || value === 'EUR'
}

export function enabledCurrencies(enableEur: boolean): Currency[] {
  return enableEur ? ['BRL', 'USD', 'EUR'] : ['BRL', 'USD']
}

// País (ISO 3166-1 alfa-2, ex.: header x-vercel-ip-country) -> moeda.
// Sem país, usa o idioma do navegador (pt-BR -> BRL). Fora do Brasil e da zona do euro: USD.
export function currencyForCountry(
  country: string | undefined | null,
  options: { enableEur?: boolean; acceptLanguage?: string | null } = {},
): Currency {
  const code = (country || '').trim().toUpperCase()
  if (code === 'BR') return 'BRL'
  if (EURO_COUNTRIES.has(code) && options.enableEur) return 'EUR'
  if (!code && /^pt-br/i.test((options.acceptLanguage || '').trim())) return 'BRL'
  return 'USD'
}

export function providerForCurrency(currency: Currency): PaymentProviderName {
  return currency === 'BRL' ? 'mercadopago' : 'stripe'
}

export function currencyForProvider(provider: PaymentProviderName): Currency {
  return provider === 'mercadopago' ? 'BRL' : 'USD'
}

export function formatMoney(cents: number, currency: Currency) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}
