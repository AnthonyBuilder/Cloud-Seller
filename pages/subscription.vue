<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { clearStoredSession, isUnauthorizedError } from '~/utils/session'

useHead({ title: 'Escolha seu armazenamento - Cloud Seller' })

const route = useRoute()

type Plan = {
  id: string
  name: string
  storage: string
  priceUsd: number
}

type Subscription = {
  planId: string
  name: string
  storage: string
  priceUsd: number
  status: 'active' | 'trial' | 'expired' | 'incomplete' | 'past_due' | 'canceled'
  trialEndsAt?: number
}

const plans = ref<Plan[]>([])
const subscription = ref<Subscription | null>(null)
const usedBytes = ref(0)
const canStartTrial = ref(false)
const loading = ref(true)
const selecting = ref('')
const startingTrial = ref(false)
const refreshing = ref(false)
const openingPortal = ref(false)
const error = ref('')
const notice = ref('')
let trialExpiryTimer: number | undefined
const otherPlans = computed(() => plans.value.filter(plan => plan.id !== subscription.value?.planId))
const canChoosePaidPlan = computed(() => {
  const status = subscription.value?.status
  return status === 'incomplete' || status === 'canceled' || status === 'trial' || status === 'expired'
})

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatTrialEnd(timestamp?: number) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function showError(caught: unknown, fallback: string) {
  error.value = getAuthError(caught, fallback).message
}

async function loadSubscription() {
  const result = await $fetch<{
    plans: Plan[]
    subscription: Subscription | null
    usedBytes: number
    canStartFreeTrial: boolean
  }>('/api/subscription', { headers: authHeaders() })
  plans.value = result.plans
  subscription.value = result.subscription
  usedBytes.value = result.usedBytes
  canStartTrial.value = result.canStartFreeTrial
  const trialEndsAt = result.subscription?.status === 'trial'
    ? result.subscription.trialEndsAt
    : undefined
  if (typeof window !== 'undefined') {
    if (trialExpiryTimer !== undefined) window.clearTimeout(trialExpiryTimer)
    if (trialEndsAt) {
      trialExpiryTimer = window.setTimeout(
        () => { void refreshPaymentStatus() },
        Math.max(trialEndsAt - Date.now(), 0) + 50,
      )
    }
  }
  return result.subscription
}

onMounted(async () => {
  if (route.query.checkout === 'success') {
    notice.value = 'Pagamento concluído. Validando sua assinatura...'
  } else if (route.query.checkout === 'cancelled') {
    notice.value = 'O pagamento foi cancelado. Nenhuma cobrança foi concluída.'
  }

  if (!localStorage.getItem('cloud-seller-id-token')) {
    await navigateTo('/login')
    return
  }

  try {
    await loadSubscription()
    if (route.query.checkout === 'success') {
      for (let attempt = 0; attempt < 8 && subscription.value?.status !== 'active'; attempt++) {
        await new Promise(resolve => window.setTimeout(resolve, 1500))
        await loadSubscription()
      }
      notice.value = subscription.value?.status === 'active'
        ? 'Pagamento confirmado. Seu armazenamento está liberado.'
        : 'Pagamento recebido. A confirmação ainda está sendo processada; atualize o status em instantes.'
    }
  } catch (caught) {
    if (isUnauthorizedError(caught)) {
      clearStoredSession()
      await navigateTo('/login?reauth=1')
      return
    }
    showError(caught, 'Não foi possível carregar os planos. Tente novamente.')
  } finally {
    loading.value = false
  }
})

async function choosePlan(plan: Plan) {
  selecting.value = plan.id
  await navigateTo({ path: '/payment', query: { plan: plan.id } })
}

async function startFreeTrial() {
  error.value = ''
  notice.value = ''
  startingTrial.value = true
  try {
    await $fetch('/api/subscription/trial', {
      method: 'POST',
      headers: authHeaders(),
    })
    await loadSubscription()
    notice.value = 'Seu plano gratuito de 100 GB está ativo por 24 horas. Não haverá cobrança automática.'
  } catch (caught) {
    if (isUnauthorizedError(caught)) {
      clearStoredSession()
      await navigateTo('/login?reauth=1')
      return
    }
    showError(caught, 'Não foi possível ativar o período gratuito.')
  } finally {
    startingTrial.value = false
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
    if (isUnauthorizedError(caught)) {
      clearStoredSession()
      await navigateTo('/login?reauth=1')
      return
    }
    showError(caught, 'Não foi possível abrir o gerenciamento da assinatura.')
  } finally {
    openingPortal.value = false
  }
}

async function refreshPaymentStatus() {
  error.value = ''
  refreshing.value = true
  try {
    await loadSubscription()
  } catch (caught) {
    if (isUnauthorizedError(caught)) {
      clearStoredSession()
      await navigateTo('/login?reauth=1')
      return
    }
    showError(caught, 'Não foi possível atualizar o status do pagamento.')
  } finally {
    refreshing.value = false
  }
}

onBeforeUnmount(() => {
  if (trialExpiryTimer !== undefined) window.clearTimeout(trialExpiryTimer)
})
</script>

<template>
  <main class="subscription-page">
    <section class="subscription-content">
      <NuxtLink class="brand auth-brand" to="/" aria-label="Cloud Seller, início">
        <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
        <span>cloud seller<span class="brand-dot">.</span></span>
      </NuxtLink>

      <header class="subscription-heading">
        <span class="eyebrow">SEU ARMAZENAMENTO</span>
        <h1>Escolha o espaço da sua nuvem</h1>
        <p>Selecione uma capacidade para ativar seu armazenamento.</p>
      </header>

      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="loading" class="subscription-loading">Carregando seu armazenamento...</p>

      <template v-else-if="subscription">
        <div
          class="subscription-plan-layout"
          :class="{ 'has-other-plans': canChoosePaidPlan }"
        >
          <div class="subscription-current-column">
            <article class="subscription-status-card">
              <div>
                <span>{{ subscription.status === 'trial' || subscription.status === 'expired' ? 'Plano gratuito' : 'Plano atual' }}</span>
                <strong>{{ subscription.name }} · {{ subscription.storage }}</strong>
                <small v-if="subscription.status === 'trial'">
                  Grátis por 24 horas · {{ formatSize(usedBytes) }} utilizados
                </small>
                <small v-else-if="subscription.status === 'expired'">
                  Período gratuito encerrado · {{ formatSize(usedBytes) }} utilizados
                </small>
                <small v-else>
                  US$ {{ subscription.priceUsd.toFixed(2) }}/mês · {{ formatSize(usedBytes) }} utilizados
                </small>
              </div>
              <span class="subscription-status" :class="`status-${subscription.status}`">
                {{ subscription.status === 'active' ? 'Ativo' : subscription.status === 'trial' ? 'Teste grátis ativo' : subscription.status === 'expired' ? 'Teste encerrado' : subscription.status === 'past_due' ? 'Pagamento atrasado' : subscription.status === 'canceled' ? 'Cancelado' : 'Pagamento pendente' }}
              </span>
            </article>
            <p class="subscription-payment-note">
              {{ subscription.status === 'active'
                ? 'Sua assinatura recorrente está ativa e seus arquivos permanecem disponíveis.'
                : subscription.status === 'trial'
                  ? `Teste grátis de 100 GB até ${formatTrialEnd(subscription.trialEndsAt)}. Sem cobrança automática; depois, seus arquivos continuam acessíveis para visualização e download.`
                  : subscription.status === 'expired'
                    ? 'Seu período gratuito terminou. Você ainda pode visualizar e baixar seus arquivos; escolha um plano pago para enviar novos arquivos.'
                : subscription.status === 'past_due'
                  ? 'Atualize o pagamento no portal seguro do Stripe para manter sua assinatura.'
                  : subscription.status === 'canceled'
                    ? 'Seu plano foi cancelado. Você pode reativá-lo escolhendo um plano e concluindo o pagamento.'
                    : 'Conclua o pagamento no Stripe para liberar os envios.' }}
            </p>
            <div class="subscription-actions">
              <NuxtLink
                v-if="subscription.status === 'active' || subscription.status === 'trial' || subscription.status === 'expired'"
                class="button button-primary subscription-dashboard-link"
                to="/dashboard"
              >
                Acessar meus arquivos <IconSymbol name="arrow-right" />
              </NuxtLink>
              <button
                v-if="subscription.status === 'active' || subscription.status === 'past_due'"
                class="button button-plan subscription-dashboard-link"
                type="button"
                :disabled="openingPortal"
                @click="openBillingPortal"
              >
                {{ openingPortal ? 'Abrindo Stripe...' : subscription.status === 'past_due' ? 'Atualizar pagamento' : 'Gerenciar assinatura' }}
                <IconSymbol name="credit-card" />
              </button>
              <NuxtLink
                v-else-if="subscription.status === 'incomplete'"
                class="button button-primary subscription-dashboard-link"
                :to="{ path: '/payment', query: { plan: subscription.planId } }"
              >
                Continuar pagamento <IconSymbol name="credit-card" />
              </NuxtLink>
              <NuxtLink
                v-else-if="subscription.status === 'trial' || subscription.status === 'expired'"
                class="button button-primary subscription-dashboard-link"
                :to="{ path: '/payment', query: { plan: subscription.planId } }"
              >
                Assinar {{ subscription.storage }} <IconSymbol name="credit-card" />
              </NuxtLink>
              <NuxtLink
                v-else
                class="button button-primary subscription-dashboard-link"
                :to="{ path: '/payment', query: { plan: subscription.planId } }"
              >
                Reativar plano <IconSymbol name="credit-card" />
              </NuxtLink>
              <button
                v-if="subscription.status === 'incomplete' || subscription.status === 'past_due' || subscription.status === 'canceled'"
                class="subscription-refresh-button"
                type="button"
                :disabled="refreshing"
                @click="refreshPaymentStatus"
              >
                <IconSymbol name="refresh" />
                {{ refreshing ? 'Atualizando...' : 'Atualizar status do pagamento' }}
              </button>
            </div>
          </div>

          <section
            v-if="canChoosePaidPlan"
            class="other-plans-section"
          >
            <header class="other-plans-heading">
              <span class="eyebrow">{{ subscription.status === 'trial' || subscription.status === 'expired' ? 'PLANOS PAGOS' : 'OUTRAS OPÇÕES' }}</span>
              <h2>{{ subscription.status === 'trial' ? 'Escolha quando quiser' : subscription.status === 'expired' ? 'Retome seus envios' : 'Outros planos' }}</h2>
              <p>{{ subscription.status === 'trial' ? 'O teste termina sem cobrança automática.' : subscription.status === 'expired' ? 'Escolha um plano para voltar a enviar arquivos.' : 'Encontre o espaço ideal para você.' }}</p>
            </header>
            <div class="subscription-plan-grid">
              <article v-if="canStartTrial" class="plan-card subscription-plan plan-alternative free-trial-option">
                <div class="plan-alternative-heading">
                  <span class="plan-alternative-icon" aria-hidden="true">
                    <IconSymbol name="clock" />
                  </span>
                  <div>
                    <h2>Teste grátis</h2>
                    <span>100 GB por 24 horas</span>
                  </div>
                </div>
                <p class="plan-price free-trial-option-price">Grátis</p>
                <button
                  class="button button-primary"
                  type="button"
                  :disabled="startingTrial || Boolean(selecting)"
                  @click="startFreeTrial"
                >
                  {{ startingTrial ? 'Ativando...' : 'Ativar teste grátis' }}
                </button>
              </article>
              <article
                v-for="plan in otherPlans"
                :key="plan.id"
                class="plan-card subscription-plan plan-alternative"
              >
                <div class="plan-alternative-heading">
                  <span class="plan-alternative-icon" aria-hidden="true">
                    <IconSymbol name="hard-drive" />
                  </span>
                  <div>
                    <h2>{{ plan.name }}</h2>
                    <span>{{ plan.storage }} de armazenamento</span>
                  </div>
                </div>
                <p class="plan-price"><span>US$</span> {{ plan.priceUsd.toFixed(2) }}<small>/mês</small></p>
                <button
                  class="button button-plan"
                  type="button"
                  :disabled="Boolean(selecting) || startingTrial"
                  @click="choosePlan(plan)"
                >
                  {{ selecting === plan.id ? 'Continuando...' : 'Escolher plano' }}
                  <IconSymbol v-if="selecting !== plan.id" name="arrow-right" />
                </button>
              </article>
            </div>
          </section>
        </div>
      </template>

      <div v-else-if="!loading" class="subscription-plan-grid subscription-chooser-grid">
        <article v-if="canStartTrial" class="plan-card subscription-plan free-trial-card">
          <span class="free-trial-badge">24 HORAS GRÁTIS</span>
          <div class="free-trial-heading">
            <span class="free-trial-icon"><IconSymbol name="clock" /></span>
            <h2>Plano gratuito</h2>
          </div>
          <p class="plan-price free-trial-price">Grátis<small>por 1 dia</small></p>
          <div class="plan-storage"><IconSymbol name="hard-drive" /> 100 GB durante o teste</div>
          <p class="free-trial-description">
            Sem cartão ou cobrança automática. Depois, seus arquivos ficam disponíveis para leitura e download.
          </p>
          <button
            class="button button-primary"
            type="button"
            :disabled="startingTrial || Boolean(selecting)"
            @click="startFreeTrial"
          >
            {{ startingTrial ? 'Ativando...' : 'Ativar teste grátis' }}
          </button>
        </article>
        <article
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card subscription-plan"
          :class="{ 'plan-featured': plan.id === 'pro' }"
        >
          <span v-if="plan.id === 'pro'" class="popular-label">MAIS ESCOLHIDO</span>
          <h2>{{ plan.name }}</h2>
          <p class="plan-price">US$ {{ plan.priceUsd.toFixed(2) }}<small>/mês</small></p>
          <div class="plan-storage"><IconSymbol name="cloud-upload" /> {{ plan.storage }} de armazenamento</div>
          <p class="subscription-used">Arquivos atuais: {{ formatSize(usedBytes) }}</p>
          <button
            class="button"
            :class="plan.id === 'pro' ? 'button-primary' : 'button-plan'"
            type="button"
            :disabled="Boolean(selecting) || startingTrial"
            @click="choosePlan(plan)"
          >
            {{ selecting === plan.id ? 'Continuando...' : 'Escolher plano' }}
          </button>
        </article>
      </div>

      <p v-if="!subscription" class="plans-footnote">
        O teste gratuito dura 24 horas, sem cobrança automática. Planos pagos são mensais e cobrados em USD.
      </p>
    </section>
  </main>
</template>
