import { buildPlanCatalog, getPlanPriceCents, isBillingInterval, resolvePriceBook } from '../utils/plan-catalog.ts'
import { currencyForCountry, providerForCurrency, enabledCurrencies, formatMoney, isCurrency } from '../utils/currency.ts'
import assert from 'node:assert/strict'
// país -> moeda
assert.equal(currencyForCountry('BR'), 'BRL')
assert.equal(currencyForCountry('br'), 'BRL')
assert.equal(currencyForCountry('US'), 'USD')
assert.equal(currencyForCountry('AR'), 'USD')
assert.equal(currencyForCountry('DE'), 'USD')                       // EUR desligada
assert.equal(currencyForCountry('DE', { enableEur: true }), 'EUR')
assert.equal(currencyForCountry('PT', { enableEur: true }), 'EUR')
assert.equal(currencyForCountry(undefined, { acceptLanguage: 'pt-BR,pt;q=0.9' }), 'BRL')
assert.equal(currencyForCountry(undefined, { acceptLanguage: 'en-US' }), 'USD')
assert.equal(currencyForCountry('', {}), 'USD')
assert.equal(currencyForCountry('US', { acceptLanguage: 'pt-BR' }), 'USD') // país vence idioma
// provedor
assert.equal(providerForCurrency('BRL'), 'mercadopago')
assert.equal(providerForCurrency('USD'), 'stripe')
assert.equal(providerForCurrency('EUR'), 'stripe')
assert.deepEqual(enabledCurrencies(false), ['BRL','USD'])
assert.ok(isCurrency('BRL') && !isCurrency('GBP'))
// livros de preço
assert.equal(resolvePriceBook(undefined), 'seguro')
assert.equal(resolvePriceBook('competitivo'), 'competitivo')
assert.equal(resolvePriceBook('qualquer'), 'seguro')
for (const book of ['seguro','competitivo']) {
  const plans = buildPlanCatalog(book)
  assert.equal(plans.length, 3)
  for (const c of ['BRL','USD','EUR']) {
    const prices = plans.map(p => getPlanPriceCents(p, c))
    assert.ok(prices.every(n => Number.isInteger(n) && n > 0), `${book} ${c} inteiros positivos`)
    assert.ok(prices[0] < prices[1] && prices[1] < prices[2], `${book} ${c} cresce com o plano`)
  }
}
const seg = buildPlanCatalog('seguro'), comp = buildPlanCatalog('competitivo')
assert.equal(seg[0].priceBrlCents, 1490)   // preços atuais do repositório preservados
assert.equal(seg[1].priceCents, 1299)
assert.equal(comp[0].priceBrlCents, 990)
// compat com checkout antigo
assert.equal(seg[2].priceBrl, 109.9)
// plano anual = 10 mensalidades
for (const plan of buildPlanCatalog('seguro')) {
  for (const c of ['BRL','USD','EUR']) {
    assert.equal(getPlanPriceCents(plan, c, 'year'), getPlanPriceCents(plan, c, 'month') * 10)
    assert.equal(getPlanPriceCents(plan, c), getPlanPriceCents(plan, c, 'month'))
  }
}
assert.equal(getPlanPriceCents(buildPlanCatalog('seguro')[0], 'BRL', 'year'), 14900)
assert.ok(isBillingInterval('year') && isBillingInterval('month') && !isBillingInterval('week'))
console.log(formatMoney(1490,'BRL'), '|', formatMoney(399,'USD'), '|', formatMoney(369,'EUR'))
console.log('TODOS OS TESTES PASSARAM')
