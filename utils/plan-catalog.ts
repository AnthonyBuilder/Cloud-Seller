// Fonte única dos planos e preços. Usada pelo servidor (cobrança) e pelas páginas públicas.
// Valores em centavos para evitar erros de arredondamento.
//
// Dois "livros de preço" (escolha com NUXT_PUBLIC_PRICE_BOOK):
// - 'seguro' (padrão): preços para o storage atual em S3 Standard, que cobra pelo download.
// - 'competitivo': preços próximos do Google One/iCloud. SÓ ative depois de migrar o storage
//   para um provedor sem taxa de saída (Cloudflare R2 ou Backblaze B2) e de medir o uso real.
//   Em S3 Standard esses preços dão prejuízo.
//
// Moedas: BRL (Mercado Pago), USD e EUR (Stripe). EUR fica desligada até configurar IVA
// (NUXT_PUBLIC_ENABLE_EUR=true). Os preços de cada moeda são tabelas fixas, nunca conversão ao vivo.
// Revise as premissas a cada trimestre ou quando o dólar variar mais de 8%.

export type Currency = 'BRL' | 'USD' | 'EUR'
export type PriceBookName = 'seguro' | 'competitivo'
export type PlanId = 'essencial' | 'pro' | 'familia'
export type BillingInterval = 'month' | 'year'

// Plano anual = 10 mensalidades (2 meses grátis).
export const ANNUAL_MONTHS_CHARGED = 10

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year'
}

type PriceCents = Record<Currency, number>

const BASE_PLANS = [
  { id: 'essencial', name: 'Essencial', storage: '100 GB', quotaBytes: 100_000_000_000 },
  { id: 'pro', name: 'Pro', storage: '500 GB', quotaBytes: 500_000_000_000 },
  { id: 'familia', name: 'Família', storage: '1 TB', quotaBytes: 1_000_000_000_000 },
] as const satisfies ReadonlyArray<{ id: PlanId; name: string; storage: string; quotaBytes: number }>

export const PRICE_BOOKS: Record<PriceBookName, Record<PlanId, PriceCents>> = {
  seguro: {
    essencial: { BRL: 1490, USD: 399, EUR: 369 },
    pro: { BRL: 5990, USD: 1299, EUR: 1199 },
    familia: { BRL: 10990, USD: 2299, EUR: 2099 },
  },
  competitivo: {
    essencial: { BRL: 990, USD: 299, EUR: 299 },
    pro: { BRL: 3490, USD: 899, EUR: 849 },
    familia: { BRL: 6490, USD: 1599, EUR: 1499 },
  },
}

export function resolvePriceBook(value: unknown): PriceBookName {
  return value === 'competitivo' ? 'competitivo' : 'seguro'
}

export function buildPlanCatalog(book: PriceBookName = 'seguro') {
  return BASE_PLANS.map((base) => {
    const prices = PRICE_BOOKS[book][base.id]
    return {
      ...base,
      priceBrlCents: prices.BRL,
      priceCents: prices.USD, // USD, mantido por compatibilidade com o checkout do Stripe
      priceEurCents: prices.EUR,
      priceBrl: prices.BRL / 100,
      priceUsd: prices.USD / 100,
      priceEur: prices.EUR / 100,
    }
  })
}

export type CatalogPlan = ReturnType<typeof buildPlanCatalog>[number]

export function getPlanPriceCents(
  plan: Pick<CatalogPlan, 'priceBrlCents' | 'priceCents' | 'priceEurCents'>,
  currency: Currency,
  interval: BillingInterval = 'month',
) {
  const monthly = currency === 'BRL'
    ? plan.priceBrlCents
    : currency === 'EUR'
      ? plan.priceEurCents
      : plan.priceCents
  return interval === 'year' ? monthly * ANNUAL_MONTHS_CHARGED : monthly
}
