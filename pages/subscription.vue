<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'

useHead({ title: 'Escolha seu armazenamento - Cloud Seller' })

type Plan = {
  id: string
  name: string
  storage: string
}

type Subscription = {
  planId: string
  name: string
  storage: string
  status: 'trial' | 'active' | 'expired'
  trialEndsAt: number
}

const plans = ref<Plan[]>([])
const subscription = ref<Subscription | null>(null)
const usedBytes = ref(0)
const loading = ref(true)
const selecting = ref('')
const error = ref('')
const notice = ref('')

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

onMounted(async () => {
  if (!localStorage.getItem('cloud-seller-id-token')) {
    await navigateTo('/login')
    return
  }

  try {
    const result = await $fetch<{
      plans: Plan[]
      subscription: Subscription | null
      usedBytes: number
    }>('/api/subscription', { headers: authHeaders() })
    plans.value = result.plans
    subscription.value = result.subscription
    usedBytes.value = result.usedBytes

    if (result.subscription && result.subscription.status !== 'expired') {
      await navigateTo('/dashboard')
    }
  } catch (caught) {
    showError(caught, 'Não foi possível carregar os planos. Tente novamente.')
  } finally {
    loading.value = false
  }
})

async function choosePlan(plan: Plan) {
  error.value = ''
  selecting.value = plan.id
  try {
    await $fetch('/api/subscription', {
      method: 'POST',
      headers: authHeaders(),
      body: { planId: plan.id },
    })
    await navigateTo('/dashboard')
  } catch (caught) {
    showError(caught, 'Não foi possível iniciar o período de teste.')
  } finally {
    selecting.value = ''
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
        <span class="eyebrow">{{ subscription ? 'SEU ARMAZENAMENTO' : 'CINCO DIAS GRÁTIS' }}</span>
        <h1>{{ subscription ? 'Seu período de teste terminou' : 'Escolha o espaço da sua nuvem' }}</h1>
        <p v-if="!subscription">Selecione uma capacidade para começar. O teste começa agora, sem cobrança.</p>
        <p v-else>Seus arquivos continuam disponíveis para baixar. Novos envios ficam pausados até a renovação.</p>
      </header>

      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="loading" class="subscription-loading">Carregando seu armazenamento...</p>

      <template v-else-if="subscription">
        <article class="subscription-status-card">
          <div>
            <span>Plano atual</span>
            <strong>{{ subscription.name }} · {{ subscription.storage }}</strong>
            <small>{{ formatSize(usedBytes) }} utilizados</small>
          </div>
          <span class="subscription-status">Teste expirado</span>
        </article>
        <p class="subscription-payment-note">
          A renovação pelo Mercado Pago será habilitada depois que os valores dos planos forem definidos.
        </p>
        <NuxtLink class="button button-primary subscription-dashboard-link" to="/dashboard">
          Acessar meus arquivos <IconSymbol name="arrow-right" />
        </NuxtLink>
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
          <p class="plan-price">5<small>dias grátis</small></p>
          <div class="plan-storage"><IconSymbol name="cloud-upload" /> {{ plan.storage }} de armazenamento</div>
          <p class="subscription-used">Arquivos atuais: {{ formatSize(usedBytes) }}</p>
          <button
            class="button"
            :class="plan.id === 'pro' ? 'button-primary' : 'button-plan'"
            type="button"
            :disabled="Boolean(selecting)"
            @click="choosePlan(plan)"
          >
            {{ selecting === plan.id ? 'Ativando...' : 'Começar teste grátis' }}
          </button>
        </article>
      </div>

      <p v-if="!subscription" class="plans-footnote">
        Capacidades em GB/TB decimais. Os valores de renovação serão informados antes de qualquer cobrança.
      </p>
    </section>
  </main>
</template>
