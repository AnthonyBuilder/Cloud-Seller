<script setup lang="ts">
useHead({ title: 'Criar conta - Cloud Seller' })

const email = ref('')
const password = ref('')
const confirmationCode = ref('')
const step = ref<'signup' | 'confirm'>('signup')
const error = ref('')
const notice = ref('')
const loading = ref(false)

function getErrorMessage(caught: unknown, fallback: string) {
  if (typeof caught === 'object' && caught !== null && 'data' in caught) {
    const data = caught.data
    if (typeof data === 'object' && data !== null) {
      if ('statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
      if ('message' in data && typeof data.message === 'string') return data.message
    }
  }

  return fallback
}

async function createAccount() {
  error.value = ''
  notice.value = ''
  const normalizedEmail = email.value.trim().toLowerCase()

  if (password.value.length < 12 || !/[A-Z]/.test(password.value) || !/[a-z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    error.value = 'Use pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.'
    return
  }

  loading.value = true
  try {
    const result = await $fetch<{ confirmed: boolean; destination: string }>('/api/auth/signup', {
      method: 'POST',
      body: { email: normalizedEmail, password: password.value },
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
    error.value = getErrorMessage(caught, 'Não foi possível criar a conta. Tente novamente.')
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
    error.value = getErrorMessage(caught, 'Não foi possível confirmar a conta. Confira o código e tente novamente.')
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
    error.value = getErrorMessage(caught, 'Não foi possível enviar outro código. Tente novamente.')
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
            maxlength="254"
            required
          />
        </label>
        <label>
          Senha
          <input
            v-model="password"
            type="password"
            placeholder="Crie uma senha"
            autocomplete="new-password"
            minlength="12"
            required
          />
        </label>
        <p class="auth-hint">Use pelo menos 12 caracteres, incluindo letras maiúsculas, minúsculas e números.</p>
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
