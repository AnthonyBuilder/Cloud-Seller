<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { clearStoredSession, isJwtExpired, isUnauthorizedError } from '~/utils/session'

useHead({ title: 'Entrar - Cloud Seller' })

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const notice = ref('')
const confirmationRequired = ref(false)
const loading = ref(false)
const mode = ref<'login' | 'forgot' | 'reset' | 'mfa'>('login')
const mfaSession = ref('')
const mfaCode = ref('')
const resetCode = ref('')
const newPassword = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (params.get('reauth') === '1') {
    notice.value = 'Sua sessão expirou. Entre novamente para continuar.'
  }
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
      navigateTo('/subscription')
    } catch (caught) {
      error.value = 'Não foi possível concluir o login com AWS Cognito.'
    } finally {
      loading.value = false
    }
    return
  }

  const idToken = localStorage.getItem('cloud-seller-id-token')
  if (localStorage.getItem('cloud-seller-session') && idToken && !isJwtExpired(idToken)) {
    await navigateTo('/subscription')
  } else if (idToken) {
    clearStoredSession()
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
    const response = await $fetch<{ idToken?: string; accessToken?: string; mfaRequired?: boolean; session?: string }>('/api/auth/login', {
      method: 'POST',
      body: { email: normalizedEmail, password: password.value },
    })
    if (response.mfaRequired && response.session) {
      mfaSession.value = response.session
      mfaCode.value = ''
      password.value = ''
      mode.value = 'mfa'
      return
    }
    if (!response.idToken || !response.accessToken) throw new Error('missing tokens')
    finishLogin(normalizedEmail, response.idToken, response.accessToken)
    password.value = ''
    await navigateTo('/subscription')
  } catch (caught) {
    const apiError = getAuthError(caught, 'Não foi possível entrar. Tente novamente.')
    error.value = apiError.message
    confirmationRequired.value = apiError.code === 'USER_NOT_CONFIRMED'
  } finally {
    loading.value = false
  }
}

function finishLogin(normalizedEmail: string, idToken: string, accessToken: string) {
  localStorage.setItem('cloud-seller-id-token', idToken)
  localStorage.setItem('cloud-seller-access-token', accessToken)
  localStorage.setItem('cloud-seller-session', JSON.stringify({
    name: normalizedEmail.split('@')[0],
    email: normalizedEmail,
  }))
}

async function submitMfa() {
  error.value = ''
  notice.value = ''
  const code = mfaCode.value.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) {
    error.value = 'Informe o código de 6 dígitos do aplicativo autenticador.'
    return
  }

  loading.value = true
  try {
    const normalizedEmail = email.value.trim().toLowerCase()
    const response = await $fetch<{ idToken: string; accessToken: string }>('/api/auth/mfa-login', {
      method: 'POST',
      body: { email: normalizedEmail, session: mfaSession.value, code },
    })
    finishLogin(normalizedEmail, response.idToken, response.accessToken)
    mfaSession.value = ''
    mfaCode.value = ''
    await navigateTo('/subscription')
  } catch (caught) {
    const apiError = getAuthError(caught, 'Não foi possível validar o código. Tente novamente.')
    error.value = apiError.message
    if (isUnauthorizedError(caught)) {
      mode.value = 'login'
      mfaSession.value = ''
    }
  } finally {
    loading.value = false
  }
}

async function requestPasswordReset() {
  error.value = ''
  notice.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value.trim().toLowerCase() },
    })
    mode.value = 'reset'
    notice.value = 'Se houver uma conta confirmada com esse e-mail, enviaremos um código para redefinir a senha.'
  } catch (caught) {
    error.value = getAuthError(caught, 'Não foi possível solicitar a redefinição. Tente novamente.').message
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  error.value = ''
  notice.value = ''

  if (!/^\d{6}$/.test(resetCode.value.trim())) {
    error.value = 'Informe o código de redefinição de 6 dígitos.'
    return
  }
  if (newPassword.value.length < 12 || !/[A-Z]/.test(newPassword.value) || !/[a-z]/.test(newPassword.value) || !/[0-9]/.test(newPassword.value)) {
    error.value = 'Use pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        email: email.value.trim().toLowerCase(),
        code: resetCode.value.trim(),
        password: newPassword.value,
      },
    })
    password.value = ''
    newPassword.value = ''
    resetCode.value = ''
    mode.value = 'login'
    notice.value = 'Senha redefinida. Entre com sua nova senha.'
  } catch (caught) {
    error.value = getAuthError(caught, 'Não foi possível redefinir a senha. Confira os dados e tente novamente.').message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <ThemeToggle class="theme-toggle-floating" />
    <a class="brand auth-brand" href="/" aria-label="Cloud Seller, início">
      <span class="brand-mark" aria-hidden="true">
        <IconSymbol name="cloud-upload" />
      </span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </a>

    <section class="auth-card" aria-labelledby="login-title">
      <div>
        <span class="eyebrow">SUA NUVEM</span>
        <h1 id="login-title">
          {{ mode === 'login' ? 'Bem-vindo de volta' : mode === 'mfa' ? 'Verificação em duas etapas' : mode === 'forgot' ? 'Recupere sua senha' : 'Redefina sua senha' }}
        </h1>
        <p>
          {{ mode === 'login'
            ? 'Entre para acessar seus arquivos.'
            : mode === 'mfa'
              ? 'Digite o código de 6 dígitos do seu aplicativo autenticador.'
              : mode === 'forgot'
              ? 'Enviaremos um código ao e-mail da sua conta.'
              : 'Digite o código recebido e escolha uma nova senha.' }}
        </p>
      </div>

      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

      <form v-if="mode === 'login'" class="auth-form" @submit.prevent="login">
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
        <button class="auth-link-button" type="button" :disabled="loading" @click="mode = 'forgot'; error = ''; notice = ''; confirmationRequired = false">
          Esqueci minha senha
        </button>
      </form>

      <form v-else-if="mode === 'mfa'" class="auth-form" @submit.prevent="submitMfa">
        <label>
          Código do aplicativo autenticador
          <input
            v-model="mfaCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="000000"
            maxlength="7"
            required
          />
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Verificando...' : 'Confirmar e entrar' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
        <button class="auth-link-button" type="button" :disabled="loading" @click="mode = 'login'; error = ''; notice = ''; mfaSession = ''">
          Voltar para entrar
        </button>
      </form>

      <form v-else-if="mode === 'forgot'" class="auth-form" @submit.prevent="requestPasswordReset">
        <label>
          E-mail
          <input
            v-model="email"
            type="email"
            placeholder="voce@email.com"
            autocomplete="email"
            autocapitalize="off"
            maxlength="254"
            required
          />
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Enviando...' : 'Enviar código' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
        <button class="auth-link-button" type="button" :disabled="loading" @click="mode = 'login'; error = ''; notice = ''">
          Voltar para entrar
        </button>
      </form>

      <form v-else class="auth-form" @submit.prevent="resetPassword">
        <label>
          E-mail
          <input v-model="email" type="email" autocomplete="email" maxlength="254" required />
        </label>
        <label>
          Código de redefinição
          <input
            v-model="resetCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="000000"
            maxlength="6"
            pattern="[0-9]{6}"
            required
          />
        </label>
        <label>
          Nova senha
          <span class="auth-password-field">
            <input
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Crie uma nova senha"
              autocomplete="new-password"
              minlength="12"
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
        <p class="auth-hint">Use pelo menos 12 caracteres, incluindo letras maiúsculas, minúsculas e números.</p>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Redefinindo...' : 'Salvar nova senha' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
      </form>

      <p v-if="confirmationRequired && mode === 'login'" class="auth-switch">
        <NuxtLink
          class="auth-link"
          :to="{ path: '/register', query: { confirm: '1', email: email.trim().toLowerCase() } }"
        >
          Confirmar meu e-mail
        </NuxtLink>
      </p>

      <p v-if="mode === 'login'" class="auth-switch">
        Ainda não tem uma conta?
        <NuxtLink class="auth-link" to="/register">Criar conta</NuxtLink>
      </p>
      <p v-else-if="mode === 'reset'" class="auth-switch">
        <button class="auth-link-button" type="button" :disabled="loading" @click="mode = 'forgot'; error = ''; notice = ''">
          Solicitar outro código
        </button>
      </p>
    </section>

    <p class="auth-footer">© 2026 Cloud Seller</p>
  </main>
</template>
