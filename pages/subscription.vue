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
  status: 'active' | 'incomplete' | 'past_due' | 'canceled'
}

const plans = ref<Plan[]>([])
const subscription = ref<Subscription | null>(null)
const usedBytes = ref(0)
const loading = ref(true)
const selecting = ref('')
const refreshing = ref(false)
const openingPortal = ref(false)
const error = ref('')
const notice = ref('')
const otherPlans = computed(() => plans.value.filter(plan => plan.id !== subscription.value?.planId))

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}` }
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function showError(caught: unknown, fallback: string) {
  error.value = getAuthError(caught, fallback).message
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
        <article class="subscription-status-card">
          <div>
            <span>Plano atual</span>
            <strong>{{ subscription.name }} · {{ subscription.storage }}</strong>
            <small>US$ {{ subscription.priceUsd.toFixed(2) }}/mês · {{ formatSize(usedBytes) }} utilizados</small>
          </div>
          <span class="subscription-status" :class="`status-${subscription.status}`">
            {{ subscription.status === 'active' ? 'Ativo' : subscription.status === 'past_due' ? 'Pagamento atrasado' : subscription.status === 'canceled' ? 'Cancelado' : 'Pagamento pendente' }}
          </span>
        </article>
        <p class="subscription-payment-note">
          {{ subscription.status === 'active'
            ? 'Sua assinatura recorrente está ativa e seus arquivos permanecem disponíveis.'
            : subscription.status === 'past_due'
              ? 'Atualize o pagamento no portal seguro do Stripe para manter sua assinatura.'
              : subscription.status === 'canceled'
                ? 'Seu plano foi cancelado. Você pode reativá-lo escolhendo um plano e concluindo o pagamento.'
                : 'Conclua o pagamento no Stripe para liberar os envios.' }}
        </p>
        <NuxtLink
          v-if="subscription.status === 'active'"
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
        </button>
        <NuxtLink
          v-else-if="subscription.status === 'incomplete'"
          class="button button-primary subscription-dashboard-link"
          :to="{ path: '/payment', query: { plan: subscription.planId } }"
        >
          Continuar pagamento <IconSymbol name="arrow-right" />
        </NuxtLink>
        <NuxtLink
          v-else
          class="button button-primary subscription-dashboard-link"
          :to="{ path: '/payment', query: { plan: subscription.planId } }"
        >
          Reativar plano <IconSymbol name="arrow-right" />
        </NuxtLink>
        <button
          v-if="subscription.status !== 'active'"
          class="subscription-refresh-button"
          type="button"
          :disabled="refreshing"
          @click="refreshPaymentStatus"
        >
          {{ refreshing ? 'Atualizando...' : 'Atualizar status do pagamento' }}
        </button>

        <section
          v-if="subscription.status === 'incomplete' || subscription.status === 'canceled'"
          class="other-plans-section"
        >
          <header class="other-plans-heading">
            <span class="eyebrow">MAIS OPÇÕES</span>
            <h2>Prefere outro plano?</h2>
            <p>Escolha outra capacidade antes de continuar para o pagamento.</p>
          </header>
          <div class="subscription-plan-grid">
            <article
              v-for="plan in otherPlans"
              :key="plan.id"
              class="plan-card subscription-plan"
              :class="{ 'plan-featured': plan.id === 'pro' }"
            >
              <span v-if="plan.id === 'pro'" class="popular-label">MAIS ESCOLHIDO</span>
              <h2>{{ plan.name }}</h2>
              <p class="plan-price">US$ {{ plan.priceUsd.toFixed(2) }}<small>/mês</small></p>
              <div class="plan-storage"><IconSymbol name="cloud-upload" /> {{ plan.storage }} de armazenamento</div>
              <button
                class="button"
                :class="plan.id === 'pro' ? 'button-primary' : 'button-plan'"
                type="button"
                :disabled="Boolean(selecting)"
                @click="choosePlan(plan)"
              >
                {{ selecting === plan.id ? 'Continuando...' : 'Escolher este plano' }}
              </button>
            </article>
          </div>
        </section>
      </template>

      <div v-else-if="!loading" class="subscription-plan-grid">
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
            :disabled="Boolean(selecting)"
            @click="choosePlan(plan)"
          >
            {{ selecting === plan.id ? 'Continuando...' : 'Escolher plano' }}
          </button>
        </article>
      </div>

      <p v-if="!subscription" class="plans-footnote">
        Capacidades em GB/TB decimais. Os valores são cobrados mensalmente em USD.
      </p>
    </section>
  </main>
</template>
