<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'

useHead({ title: 'Entrar - Cloud Seller' })

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const notice = ref('')
const confirmationRequired = ref(false)
const loading = ref(false)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (params.get('registered') === '1') {
    notice.value = 'Conta confirmada. Agora você já pode entrar.'
  }

  if (code) {
    loading.value = true
    try {
      const response = await $fetch<{ id_token: string; access_token: string }>('/api/auth/token', {
        method: 'POST',
        body: { code },
      })
      localStorage.setItem('cloud-seller-id-token', response.id_token)
      localStorage.setItem('cloud-seller-access-token', response.access_token)
      localStorage.setItem('cloud-seller-session', JSON.stringify({
        name: 'Cliente',
        email: '',
      }))
      navigateTo('/dashboard')
    } catch (caught) {
      error.value = 'Não foi possível concluir o login com AWS Cognito.'
    } finally {
      loading.value = false
    }
    return
  }

  if (import.meta.client && localStorage.getItem('cloud-seller-session') && localStorage.getItem('cloud-seller-id-token')) {
    navigateTo('/dashboard')
  }
})

async function login() {
  error.value = ''
  notice.value = ''
  confirmationRequired.value = false
  const normalizedEmail = email.value.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !password.value) {
    error.value = 'Informe um e-mail válido e sua senha.'
    return
  }

  loading.value = true
  try {
    const response = await $fetch<{ idToken: string; accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: normalizedEmail, password: password.value },
    })
    localStorage.setItem('cloud-seller-id-token', response.idToken)
    localStorage.setItem('cloud-seller-access-token', response.accessToken)
    localStorage.setItem('cloud-seller-session', JSON.stringify({
      name: normalizedEmail.split('@')[0],
      email: normalizedEmail,
    }))
    password.value = ''
    await navigateTo('/dashboard')
  } catch (caught) {
    const apiError = getAuthError(caught, 'Não foi possível entrar. Tente novamente.')
    error.value = apiError.message
    confirmationRequired.value = apiError.code === 'USER_NOT_CONFIRMED'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <a class="brand auth-brand" href="/" aria-label="Cloud Seller, início">
      <span class="brand-mark" aria-hidden="true">
        <IconSymbol name="cloud-upload" />
      </span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </a>

    <section class="auth-card" aria-labelledby="login-title">
      <div>
        <span class="eyebrow">SUA NUVEM</span>
        <h1 id="login-title">Bem-vindo de volta</h1>
        <p>Entre para acessar seus arquivos.</p>
      </div>

      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

      <form class="auth-form" @submit.prevent="login">
        <label>
          E-mail
          <input
            v-model="email"
            type="email"
            placeholder="voce@email.com"
            autocomplete="username"
            autocapitalize="off"
            maxlength="254"
            required
          />
        </label>
        <label>
          Senha
          <span class="auth-password-field">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Digite sua senha"
              autocomplete="current-password"
              required
            />
            <button
              class="auth-password-toggle"
              type="button"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Ocultar' : 'Mostrar' }}
            </button>
          </span>
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar na minha nuvem' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
      </form>

      <p v-if="confirmationRequired" class="auth-switch">
        <NuxtLink
          class="auth-link"
          :to="{ path: '/register', query: { confirm: '1', email: email.trim().toLowerCase() } }"
        >
          Confirmar meu e-mail
        </NuxtLink>
      </p>

      <p class="auth-switch">
        Ainda não tem uma conta?
        <NuxtLink class="auth-link" to="/register">Criar conta</NuxtLink>
      </p>
    </section>

    <p class="auth-footer">© 2026 Cloud Seller</p>
  </main>
</template>
