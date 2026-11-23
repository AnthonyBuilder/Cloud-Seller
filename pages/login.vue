<script setup lang="ts">
useHead({ title: 'Entrar - Cloud Seller' })

const config = useRuntimeConfig()
const email = ref('')
const password = ref('')
const error = ref('')
const notice = ref('')
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

  if (import.meta.client && localStorage.getItem('cloud-seller-session')) {
    navigateTo('/dashboard')
  }
})

async function login() {
  error.value = ''

  if (config.public.cognitoDomain) {
    const params = new URLSearchParams({
      client_id: config.public.cognitoClientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: config.public.cognitoRedirectUri,
    })
    window.location.assign(`https://${config.public.cognitoDomain}/login?${params}`)
    return
  }

  if (!email.value.includes('@') || password.value.length < 6) {
    error.value = 'Informe um e-mail válido e uma senha com pelo menos 6 caracteres.'
    return
  }

  loading.value = true
  await new Promise(resolve => setTimeout(resolve, 450))

  localStorage.setItem('cloud-seller-session', JSON.stringify({
    name: email.value.split('@')[0],
    email: email.value,
  }))

  loading.value = false
  navigateTo('/dashboard')
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

      <div v-if="config.public.cognitoDomain" class="auth-form">
        <p class="auth-hint">Entre com sua conta segura do AWS Cognito.</p>
        <button class="button button-primary auth-submit" type="button" @click="login">
          Entrar com AWS Cognito
          <IconSymbol name="arrow-right" />
        </button>
      </div>

      <form v-else class="auth-form" @submit.prevent="login">
        <label>
          E-mail
          <input v-model="email" type="email" placeholder="voce@email.com" autocomplete="email" required />
        </label>
        <label>
          Senha
          <input v-model="password" type="password" placeholder="Digite sua senha" autocomplete="current-password" required />
        </label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar na minha nuvem' }}
          <IconSymbol v-if="!loading" name="arrow-right" />
        </button>
      </form>

      <p v-if="config.public.cognitoDomain" class="auth-switch">
        Ainda não tem uma conta?
        <NuxtLink class="auth-link" to="/register">Criar conta</NuxtLink>
      </p>

      <div v-if="!config.public.cognitoDomain" class="demo-access">
        <strong>Acesso de demonstração</strong>
        <span>Qualquer e-mail válido e senha com 6 caracteres.</span>
      </div>
    </section>

    <p class="auth-footer">© 2026 Cloud Seller</p>
  </main>
</template>
