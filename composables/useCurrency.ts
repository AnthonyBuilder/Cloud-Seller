import { currencyForCountry, enabledCurrencies, isCurrency } from '~/utils/currency'
import { buildPlanCatalog, isBillingInterval, resolvePriceBook, type BillingInterval, type Currency } from '~/utils/plan-catalog'

// Moeda do visitante: escolha manual (cookie) > país detectado pela Vercel > idioma do navegador > USD.
export function useCurrency() {
  const config = useRuntimeConfig()
  const enableEur = String(config.public.enableEur) === 'true'
  const available = enabledCurrencies(enableEur)

  const cookie = useCookie<string | null>('cs_currency', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
    default: () => null,
  })

  const detected = useState<Currency>('cs-detected-currency', () => {
    const headers = useRequestHeaders(['x-vercel-ip-country', 'accept-language'])
    return currencyForCountry(headers['x-vercel-ip-country'], {
      enableEur,
      acceptLanguage: headers['accept-language'],
    })
  })

  const currency = computed<Currency>(() => {
    const chosen = cookie.value
    return isCurrency(chosen) && available.includes(chosen) ? chosen : detected.value
  })

  function setCurrency(next: Currency) {
    if (available.includes(next)) cookie.value = next
  }

  return { currency, setCurrency, available }
}

export function usePlanCatalog() {
  const config = useRuntimeConfig()
  return buildPlanCatalog(resolvePriceBook(config.public.priceBook))
}

// Ciclo de cobrança escolhido (mensal ou anual), lembrado em cookie.
export function useBillingInterval() {
  const cookie = useCookie<string | null>('cs_interval', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
    default: () => null,
  })
  const interval = computed<BillingInterval>(() => (isBillingInterval(cookie.value) ? cookie.value : 'month'))
  function setInterval(next: BillingInterval) {
    cookie.value = next
  }
  return { interval, setInterval }
}
