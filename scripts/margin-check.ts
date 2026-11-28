// Calcula a margem de contribuição por plano e moeda.
// Uso: npm run margin-check            (livro de preços e storage atuais)
//      PRICE_BOOK=competitivo STORAGE_PROVIDER=r2 npm run margin-check
// Falha (exit 1) se a margem com uso típico ficar abaixo de MIN_MARGIN (padrão 15%).
// Todas as premissas abaixo são estimativas: substitua pelos dados reais de uso.
import { buildPlanCatalog, resolvePriceBook, getPlanPriceCents, type Currency } from '../utils/plan-catalog.ts'

const FX = Number(process.env.FX || 5.9)              // R$ por US$ (referência; só para auditoria)
const MIN_MARGIN = Number(process.env.MIN_MARGIN || 0.15)
const EGRESS_SHARE = Number(process.env.EGRESS_SHARE || 0.1) // % do armazenado baixado por mês

const STORAGE = {
  s3: { gb: 0.023, egressGb: 0.09, perUser: 0.15 },   // S3 Standard us-east (cobra download)
  r2: { gb: 0.015, egressGb: 0, perUser: 0.12 },      // Cloudflare R2 (sem taxa de saída)
  b2: { gb: 0.00695, egressGb: 0, perUser: 0.12 },    // Backblaze B2 (saída grátis até 3x)
} as const
type Provider = keyof typeof STORAGE

// Uso típico da cota por plano (medir com dados reais).
const UTILIZATION: Record<string, number> = { essencial: 0.6, pro: 0.45, familia: 0.35 }

const FEES: Record<Currency, { pct: number; fixUsd: number }> = {
  BRL: { pct: 0.035, fixUsd: 0.3 / 5.9 },
  USD: { pct: 0.05, fixUsd: 0.3 },
  EUR: { pct: 0.05, fixUsd: 0.3 },
}
const TAX = 0.08       // impostos sobre a receita (confirmar com o contador)
const RESERVE = 0.1    // suporte e inadimplência

const book = resolvePriceBook(process.env.PRICE_BOOK || process.env.NUXT_PUBLIC_PRICE_BOOK)
const provider = (process.env.STORAGE_PROVIDER || 's3') as Provider
if (!(provider in STORAGE)) throw new Error(`STORAGE_PROVIDER inválido: ${provider}`)
const s = STORAGE[provider]

const toUsd = (cents: number, currency: Currency) =>
  currency === 'BRL' ? cents / 100 / FX : currency === 'EUR' ? (cents / 100) * 1.08 : cents / 100

let failed = false
console.log(`Livro de preços: ${book} | storage: ${provider} | câmbio ref.: R$ ${FX} | download: ${EGRESS_SHARE * 100}% do armazenado\n`)
for (const plan of buildPlanCatalog(book)) {
  const gb = plan.quotaBytes / 1e9
  for (const currency of ['BRL', 'USD', 'EUR'] as const) {
    const revenue = toUsd(getPlanPriceCents(plan, currency), currency)
    const stored = gb * (UTILIZATION[plan.id] ?? 0.4)
    const cost = stored * s.gb + stored * EGRESS_SHARE * s.egressGb + s.perUser
    const fee = revenue * FEES[currency].pct + FEES[currency].fixUsd
    const net = revenue - fee - revenue * TAX - revenue * RESERVE - cost
    const margin = net / revenue
    const flag = margin < MIN_MARGIN ? ' ⚠️ ABAIXO DO MÍNIMO' : ''
    if (margin < MIN_MARGIN && currency !== 'EUR') failed = true // EUR só conta quando habilitada
    console.log(`${plan.name.padEnd(10)} ${currency}  receita US$ ${revenue.toFixed(2).padStart(6)} | custo US$ ${cost.toFixed(2).padStart(6)} | margem ${(margin * 100).toFixed(0).padStart(4)}%${flag}`)
  }
}
if (failed) {
  console.error(`\nMargem abaixo de ${MIN_MARGIN * 100}% em ao menos um plano. Revise preços, storage ou premissas.`)
  process.exit(1)
}
