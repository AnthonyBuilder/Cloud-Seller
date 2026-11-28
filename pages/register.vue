<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'

useHead({ title: 'Criar conta - Cloud Seller' })

const route = useRoute()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const acceptTerms = ref(false)
const confirmationCode = ref('')
const step = ref<'signup' | 'confirm'>('signup')
const error = ref('')
const notice = ref('')
const loading = ref(false)

if (route.query.confirm === '1' && typeof route.query.email === 'string') {
  email.value = route.query.email.trim().toLowerCase()
  step.value = 'confirm'
  notice.value = 'Confirme seu e-mail para acessar sua conta.'
}

function showError(caught: unknown, fallback: string) {
  const apiError = getAuthError(caught, fallback)
  error.value = apiError.message
}

async function createAccount() {
  error.value = ''
  notice.value = ''
  const normalizedEmail = email.value.trim().toLowerCase()

  if (password.value.length < 12 || !/[A-Z]/.test(password.value) || !/[a-z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    error.value = 'Use pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.'
    return
  }

  if (!acceptTerms.value) {
    error.value = 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.'
    return
  }

  loading.value = true
  try {
    const result = await $fetch<{ confirmed: boolean; destination: string }>('/api/auth/signup', {
      method: 'POST',
      body: { email: normalizedEmail, password: password.value, acceptedTerms: true, termsVersion: TERMS_VERSION },
    })
    email.value = normalizedEmail
    step.value = result.confirmed ? 'signup' : 'confirm'
    password.value = ''
    if (result.confirmed) {
      await navigateTo('/login?registered=1')
      return
    }
    notice.value = `Enviamos um código de confirmação para ${result.destination}.`
  } catch (caught) {
    showError(caught, 'Não foi possível criar a conta. Tente novamente.')
  } finally {
    loading.value = false
  }
}

async function confirmAccount() {
  error.value = ''
  notice.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/confirm', {
      method: 'POST',
      body: { email: email.value.trim().toLowerCase(), code: confirmationCode.value.trim() },
    })
    await navigateTo('/login?registered=1')
  } catch (caught) {
    showError(caught, 'Não foi possível confirmar a conta. Confira o código e tente novamente.')
  } finally {
    loading.value = false
  }
}

async function resendCode() {
  error.value = ''
  notice.value = ''
  loading.value = true

  try {
    const result = await $fetch<{ destination: string }>('/api/auth/resend', {
      method: 'POST',
      body: { email: email.value.trim().toLowerCase() },
    })
    notice.value = `Enviamos um novo código para ${result.destination}.`
  } catch (caught) {
    showError(caught, 'Não foi possível enviar outro código. Tente novamente.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <NuxtLink class="brand auth-brand" to="/" aria-label="Cloud Seller, início">
      <span class="brand-mark" aria-hidden="true">
        <IconSymbol name="cloud-upload" />
      </span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </NuxtLink>

    <section class="auth-card" aria-labelledby="register-title">
      <div>
        <span class="eyebrow">SUA NUVEM</span>
        <h1 id="register-title">{{ step === 'signup' ? 'Crie sua conta' : 'Confirme seu e-mail' }}</h1>
        <p>{{ step === 'signup' ? 'Comece a guardar seus arquivos com segurança.' : 'Digite o código enviado para confirmar a conta.' }}</p>
      </div>

      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

      <form v-if="step === 'signup'" class="auth-form" @submit.prevent="createAccount">
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
        <label>
          Senha
          <span class="auth-password-field">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Crie uma senha"
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
        <label class="auth-consent">
          <input v-model="acceptTerms" type="checkbox" required />
          <span>
            Li e aceito os <NuxtLink to="/termos" target="_blank">Termos de Uso</NuxtLink>
            e a <NuxtLink to="/privacidade" target="_blank">Política de Privacidade</NuxtLink>.
          </span>
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Criando conta...' : 'Criar conta' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
      </form>

      <form v-else class="auth-form" @submit.prevent="confirmAccount">
        <label>
          Código de confirmação
          <input
            v-model="confirmationCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="000000"
            maxlength="6"
            pattern="[0-9]{6}"
            required
          />
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Confirmando...' : 'Confirmar conta' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
        <button class="auth-link-button" type="button" :disabled="loading" @click="resendCode">
          Não recebeu o código? Enviar novamente
        </button>
      </form>

      <p class="auth-switch">
        Já tem uma conta?
        <NuxtLink class="auth-link" to="/login">Entrar</NuxtLink>
      </p>
    </section>

    <p class="auth-footer">© 2026 Cloud Seller</p>
  </main>
</template>
