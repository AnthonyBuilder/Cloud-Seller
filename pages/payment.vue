<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { clearStoredSession, isJwtExpired, isUnauthorizedError } from '~/utils/session'

useHead({ title: 'Pagamento seguro - Cloud Seller' })

const route = useRoute()

type Plan = {
  id: string
  name: string
  storage: string
  quotaBytes: number
  priceUsd: number
}

type Subscription = {
  planId: string
  status: 'active' | 'incomplete' | 'past_due' | 'canceled'
}

const plans = ref<Plan[]>([])
const subscription = ref<Subscription | null>(null)
const usedBytes = ref(0)
const loading = ref(true)
const startingCheckout = ref(false)
const openingPortal = ref(false)
const error = ref('')
const notice = ref('')

const requestedPlanId = computed(() => typeof route.query.plan === 'string' ? route.query.plan : '')
const selectedPlan = computed(() => {
  const existingPlanHasPriority = subscription.value?.status === 'active' || subscription.value?.status === 'past_due'
  const planId = existingPlanHasPriority
    ? subscription.value?.planId || ''
    : requestedPlanId.value || subscription.value?.planId || ''
  return plans.value.find(plan => plan.id === planId) || null
})
const planExceedsUsage = computed(() => Boolean(selectedPlan.value && usedBytes.value > selectedPlan.value.quotaBytes))

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

async function loadSubscription() {
  const result = await $fetch<{
    plans: Plan[]
    subscription: Subscription | null
    usedBytes: number
  }>('/api/subscription', { headers: authHeaders() })
  plans.value = result.plans
  subscription.value = result.subscription
  usedBytes.value = result.usedBytes
}

function handleRequestError(caught: unknown, fallback: string) {
  if (isUnauthorizedError(caught)) {
    clearStoredSession()
    void navigateTo('/login?reauth=1')
    return
  }
  error.value = getAuthError(caught, fallback).message
}

onMounted(async () => {
  const idToken = localStorage.getItem('cloud-seller-id-token')
  if (!idToken || isJwtExpired(idToken)) {
    clearStoredSession()
    await navigateTo('/login?reauth=1')
    return
  }

  if (route.query.checkout === 'success') {
    notice.value = 'Pagamento recebido. Estamos confirmando sua assinatura...'
  } else if (route.query.checkout === 'cancelled') {
    notice.value = 'O pagamento foi cancelado. Nenhuma cobrança foi concluída.'
  }

  try {
    await loadSubscription()
    if (route.query.checkout === 'success') {
      for (let attempt = 0; attempt < 8 && subscription.value?.status !== 'active'; attempt++) {
        await new Promise(resolve => window.setTimeout(resolve, 1500))
        await loadSubscription()
      }
      notice.value = subscription.value?.status === 'active'
        ? 'Pagamento confirmado. Seu armazenamento está pronto.'
        : 'Pagamento recebido. A confirmação ainda está sendo processada; atualize o status em instantes.'
    }

    if (!selectedPlan.value && !requestedPlanId.value && !subscription.value) {
      await navigateTo('/subscription')
    }
  } catch (caught) {
    handleRequestError(caught, 'Não foi possível carregar os dados do pagamento.')
  } finally {
    loading.value = false
  }
})

async function startCheckout() {
  if (!selectedPlan.value || planExceedsUsage.value) return
  error.value = ''
  startingCheckout.value = true
  try {
    const result = await $fetch<{ url: string }>('/api/billing/checkout', {
      method: 'POST',
      headers: authHeaders(),
      body: { planId: selectedPlan.value.id },
    })
    window.location.assign(result.url)
  } catch (caught) {
    handleRequestError(caught, 'Não foi possível iniciar o pagamento seguro.')
  } finally {
    startingCheckout.value = false
  }
}

async function openBillingPortal() {
  error.value = ''
  openingPortal.value = true
  try {
    const result = await $fetch<{ url: string }>('/api/billing/portal', {
      method: 'POST',
      headers: authHeaders(),
    })
    window.location.assign(result.url)
  } catch (caught) {
    handleRequestError(caught, 'Não foi possível abrir o gerenciamento do pagamento.')
  } finally {
    openingPortal.value = false
  }
}

async function refreshPaymentStatus() {
  error.value = ''
  try {
    await loadSubscription()
    notice.value = subscription.value?.status === 'active'
      ? 'Pagamento confirmado. Seu armazenamento está pronto.'
      : 'O pagamento ainda está sendo confirmado. Tente atualizar novamente em instantes.'
  } catch (caught) {
    handleRequestError(caught, 'Não foi possível atualizar o status do pagamento.')
  }
}
</script>

<template>
  <main class="subscription-page payment-page">
    <section class="subscription-content">
      <NuxtLink class="brand auth-brand" to="/" aria-label="Cloud Seller, início">
        <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
        <span>cloud seller<span class="brand-dot">.</span></span>
      </NuxtLink>

      <header class="subscription-heading">
        <span class="eyebrow">PAGAMENTO SEGURO</span>
        <h1>Revise seu plano</h1>
        <p>Você será direcionado ao Stripe para informar os dados de pagamento.</p>
      </header>

      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-if="notice" class="auth-success payment-notice" role="status">{{ notice }}</p>
      <p v-if="loading" class="subscription-loading">Carregando os dados do pagamento...</p>

      <article v-else-if="selectedPlan" class="payment-order-card">
        <div class="payment-order-heading">
          <div>
            <span>PLANO SELECIONADO</span>
            <h2>{{ selectedPlan.name }}</h2>
          </div>
          <strong>{{ selectedPlan.storage }}</strong>
        </div>

        <dl class="payment-order-details">
          <div>
            <dt>Armazenamento usado</dt>
            <dd>{{ formatSize(usedBytes) }}</dd>
          </div>
          <div>
            <dt>Recorrência</dt>
            <dd>Mensal</dd>
          </div>
          <div class="payment-total">
            <dt>Total por mês</dt>
            <dd>US$ {{ selectedPlan.priceUsd.toFixed(2) }}</dd>
          </div>
        </dl>

        <p v-if="planExceedsUsage" class="auth-error" role="alert">
          Seus arquivos excedem a capacidade deste plano. Escolha um plano maior antes de continuar.
        </p>
        <p
          v-else-if="subscription?.status === 'past_due'"
          class="payment-security-note"
        >
          Sua assinatura está com pagamento atrasado. Atualize o método de pagamento no portal do Stripe para evitar uma cobrança duplicada.
        </p>
        <p v-else class="payment-security-note">
          O Stripe processa o pagamento. Os dados do seu cartão não são armazenados pelo Cloud Seller.
        </p>

        <div class="payment-actions">
          <button
            v-if="subscription?.status === 'past_due'"
            class="button button-primary"
            type="button"
            :disabled="openingPortal"
            @click="openBillingPortal"
          >
            {{ openingPortal ? 'Abrindo Stripe...' : 'Atualizar pagamento no Stripe' }}
          </button>
          <button
            v-else-if="subscription?.status !== 'active'"
            class="button button-primary"
            type="button"
            :disabled="startingCheckout || planExceedsUsage"
            @click="startCheckout"
          >
            {{ startingCheckout ? 'Conectando ao Stripe...' : 'Continuar para pagamento' }}
          </button>
          <NuxtLink v-else class="button button-primary" to="/dashboard">
            Acessar meus arquivos <IconSymbol name="arrow-right" />
          </NuxtLink>

          <NuxtLink
            v-if="subscription?.status !== 'active' && subscription?.status !== 'past_due'"
            class="button button-plan"
            to="/subscription"
          >
            Trocar plano
          </NuxtLink>
          <button
            v-if="subscription?.status === 'active'"
            class="button button-plan"
            type="button"
            :disabled="openingPortal"
            @click="openBillingPortal"
          >
            Gerenciar assinatura
          </button>
          <button
            v-if="route.query.checkout === 'success' && subscription?.status !== 'active'"
            class="payment-refresh-button"
            type="button"
            @click="refreshPaymentStatus"
          >
            Atualizar status do pagamento
          </button>
        </div>
      </article>

      <div v-else-if="!loading" class="payment-order-card payment-invalid-plan">
        <p>Não foi possível identificar o plano. Volte à página de planos e selecione uma opção.</p>
        <NuxtLink class="button button-primary" to="/subscription">Ver planos</NuxtLink>
      </div>
    </section>
  </main>
</template>
