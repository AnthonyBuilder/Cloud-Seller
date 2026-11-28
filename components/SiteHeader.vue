<script setup lang="ts">
const menuOpen = ref(false)
const isScrolled = ref(false)
const route = useRoute()

watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function updateScrollState() {
  isScrolled.value = window.scrollY > 24
}

onMounted(() => {
  updateScrollState()
  window.addEventListener('scroll', updateScrollState, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollState)
})
</script>

<template>
  <header class="site-header page-wrap" :class="{ 'site-header-scrolled': isScrolled }">
    <NuxtLink class="brand" to="/" aria-label="Cloud Seller, início">
      <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
      <span>cloud seller<span class="brand-dot">.</span></span>
    </NuxtLink>

    <nav id="site-navigation" class="desktop-nav" :class="{ 'site-nav-open': menuOpen }" aria-label="Navegação principal">
      <NuxtLink to="/como-funciona">Como funciona</NuxtLink>
      <NuxtLink to="/seguranca">Segurança</NuxtLink>
      <NuxtLink to="/sobre">Sobre</NuxtLink>
      <NuxtLink to="/contato">Contato</NuxtLink>
      <NuxtLink to="/#planos">Planos</NuxtLink>
    </nav>

    <ThemeToggle class="header-theme-toggle" />

    <NuxtLink class="button button-small button-outline header-action" to="/login" aria-label="Acessar minha nuvem" title="Acessar minha nuvem">
      <span class="header-action-label">Entrar</span>
      <IconSymbol name="user" />
    </NuxtLink>

    <button
      class="menu-toggle"
      type="button"
      :aria-expanded="menuOpen"
      aria-controls="site-navigation"
      :aria-label="menuOpen ? 'Fechar menu' : 'Abrir menu'"
      @click="menuOpen = !menuOpen"
    >
      <span />
      <span />
      <span />
    </button>
  </header>
</template>
