// Fonte única dos planos e preços. Usada pelo servidor (cobrança) e pelas páginas públicas.
// Valores em centavos para evitar erros de arredondamento; priceBrl/priceUsd são derivados.
//
// Premissas de custo (revisar a cada mudança de câmbio ou de preço da AWS):
// - S3 Standard ~US$ 0,023/GB-mês e saída para a internet ~US$ 0,09/GB
// - dólar ~R$ 5,80; taxa do gateway ~5% + tarifa fixa; impostos ~6%
// - uso médio esperado: 60% (100 GB), 45% (500 GB) e 35% (1 TB) da cota
const plan = <const T extends { priceBrlCents: number; priceCents: number }>(definition: T) => ({
  ...definition,
  priceBrl: definition.priceBrlCents / 100,
  priceUsd: definition.priceCents / 100,
})

export const STORAGE_PLAN_CATALOG = [
  plan({ id: 'essencial', name: 'Essencial', storage: '100 GB', quotaBytes: 100_000_000_000, priceBrlCents: 1490, priceCents: 399 }),
  plan({ id: 'pro', name: 'Pro', storage: '500 GB', quotaBytes: 500_000_000_000, priceBrlCents: 5990, priceCents: 1299 }),
  plan({ id: 'familia', name: 'Família', storage: '1 TB', quotaBytes: 1_000_000_000_000, priceBrlCents: 10990, priceCents: 2299 }),
] as const

export function formatPlanBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatPlanUsd(cents: number) {
  return `US$ ${(cents / 100).toFixed(2)}`
}
