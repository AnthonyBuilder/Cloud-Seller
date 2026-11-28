<script setup lang="ts">
import { getAuthError } from '~/utils/auth-errors'
import { clearStoredSession, isJwtExpired, isUnauthorizedError } from '~/utils/session'

useHead({ title: 'Minha conta - Cloud Seller' })

const loading = ref(true)
const working = ref(false)
const error = ref('')
const notice = ref('')
const mfaEnabled = ref(false)
const setup = ref<{ secret: string; otpauthUri: string } | null>(null)
const code = ref('')
const disablePassword = ref(false)
const password = ref('')
const email = ref('')

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem('cloud-seller-id-token')}`,
    'x-access-token': localStorage.getItem('cloud-seller-access-token') || '',
  }
}

function handleError(caught: unknown, fallback: string) {
  if (isUnauthorizedError(caught) && !setup.value && !password.value) {
    clearStoredSession()
    void navigateTo('/login?reauth=1')
    return
  }
  error.value = getAuthError(caught, fallback).message
}

onMounted(async () => {
  const idToken = localStorage.getItem('cloud-seller-id-token')
  const accessToken = localStorage.getItem('cloud-seller-access-token')
  if (!idToken || !accessToken || isJwtExpired(idToken)) {
    clearStoredSession()
    await navigateTo('/login?reauth=1')
    return
  }
  try {
    email.value = (JSON.parse(localStorage.getItem('cloud-seller-session') || '{}') as { email?: string }).email || ''
  } catch {
    email.value = ''
  }
  try {
    const result = await $fetch<{ enabled: boolean }>('/api/account/mfa/status', { headers: authHeaders() })
    mfaEnabled.value = result.enabled
  } catch (caught) {
    handleError(caught, 'Não foi possível carregar suas configurações de segurança.')
  } finally {
    loading.value = false
  }
})

async function startSetup() {
  error.value = ''
  notice.value = ''
  working.value = true
  try {
    setup.value = await $fetch<{ secret: string; otpauthUri: string }>('/api/account/mfa/setup', {
      method: 'POST',
      headers: authHeaders(),
    })
    code.value = ''
  } catch (caught) {
    handleError(caught, 'Não foi possível iniciar a configuração.')
  } finally {
    working.value = false
  }
}

async function confirmSetup() {
  error.value = ''
  notice.value = ''
  if (!/^\d{6}$/.test(code.value.replace(/\s/g, ''))) {
    error.value = 'Informe o código de 6 dígitos mostrado no aplicativo.'
    return
  }
  working.value = true
  try {
    await $fetch('/api/account/mfa/verify', {
      method: 'POST',
      headers: authHeaders(),
      body: { code: code.value.replace(/\s/g, '') },
    })
    mfaEnabled.value = true
    setup.value = null
    code.value = ''
    notice.value = 'Verificação em duas etapas ativada. No próximo login, vamos pedir o código do aplicativo.'
  } catch (caught) {
    handleError(caught, 'Não foi possível ativar a verificação.')
  } finally {
    working.value = false
  }
}

async function disableMfa() {
  error.value = ''
  notice.value = ''
  if (!password.value) {
    error.value = 'Informe sua senha para desativar.'
    return
  }
  working.value = true
  try {
    await $fetch('/api/account/mfa/disable', {
      method: 'POST',
      headers: authHeaders(),
      body: { password: password.value },
    })
    mfaEnabled.value = false
    disablePassword.value = false
    password.value = ''
    notice.value = 'Verificação em duas etapas desativada.'
  } catch (caught) {
    handleError(caught, 'Não foi possível desativar a verificação.')
  } finally {
    working.value = false
  }
}

function groupedSecret(secret: string) {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

function logout() {
  clearStoredSession()
  void navigateTo('/login')
}
</script>

<template>
  <main class="auth-page account-page">
    <NuxtLink class="brand auth-brand" to="/dashboard" aria-label="Cloud Seller, meus arquivos">
      <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </NuxtLink>

    <section class="auth-card account-card" aria-labelledby="account-title">
      <div>
        <span class="eyebrow">MINHA CONTA</span>
        <h1 id="account-title">Segurança e atalhos</h1>
        <p v-if="email">{{ email }}</p>
      </div>

      <p v-if="notice" class="auth-success" role="status">{{ notice }}</p>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <p v-if="loading" class="subscription-loading">Carregando...</p>

      <template v-else>
        <section class="account-section" aria-labelledby="mfa-title">
          <h2 id="mfa-title">Verificação em duas etapas</h2>
          <p class="account-status">
            Status:
            <strong :class="mfaEnabled ? 'account-on' : 'account-off'">{{ mfaEnabled ? 'ativada' : 'desativada' }}</strong>
          </p>
          <p class="auth-hint">Além da senha, pedimos um código de 6 dígitos de um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy, 1Password). Protege seus arquivos mesmo se sua senha vazar.</p>

          <template v-if="!mfaEnabled && !setup">
            <button class="button button-primary" type="button" :disabled="working" @click="startSetup">
              {{ working ? 'Gerando...' : 'Ativar verificação em duas etapas' }}
            </button>
          </template>

          <form v-if="setup" class="auth-form" @submit.prevent="confirmSetup">
            <ol class="account-steps">
              <li>Abra seu aplicativo autenticador e adicione uma conta pela chave de configuração abaixo (ou toque no link, se estiver no celular).</li>
              <li>Digite aqui o código de 6 dígitos que o aplicativo mostrar.</li>
            </ol>
            <p class="account-secret" aria-label="Chave de configuração">{{ groupedSecret(setup.secret) }}</p>
            <a class="text-link" :href="setup.otpauthUri">Abrir no aplicativo autenticador</a>
            <label>
              Código de 6 dígitos
              <input
                v-model="code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                placeholder="000000"
                maxlength="7"
                required
              />
            </label>
            <button class="button button-primary auth-submit" type="submit" :disabled="working">
              {{ working ? 'Verificando...' : 'Confirmar e ativar' }}
            </button>
            <button class="auth-link-button" type="button" :disabled="working" @click="setup = null; code = ''">Cancelar</button>
          </form>

          <template v-if="mfaEnabled">
            <button v-if="!disablePassword" class="button button-outline" type="button" @click="disablePassword = true">Desativar</button>
            <form v-else class="auth-form" @submit.prevent="disableMfa">
              <label>
                Confirme sua senha
                <input v-model="password" type="password" autocomplete="current-password" required />
              </label>
              <button class="button button-primary auth-submit" type="submit" :disabled="working">
                {{ working ? 'Desativando...' : 'Desativar verificação' }}
              </button>
              <button class="auth-link-button" type="button" :disabled="working" @click="disablePassword = false; password = ''">Cancelar</button>
            </form>
          </template>
        </section>

        <nav class="account-links" aria-label="Atalhos">
          <NuxtLink to="/dashboard">Meus arquivos</NuxtLink>
          <NuxtLink to="/trash">Lixeira</NuxtLink>
          <NuxtLink to="/subscription">Plano e pagamento</NuxtLink>
          <NuxtLink to="/backup">Baixar o app de backup</NuxtLink>
          <button class="auth-link-button" type="button" @click="logout">Sair da conta</button>
        </nav>
      </template>
    </section>
  </main>
</template>
