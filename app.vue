<script setup lang="ts">
const route = useRoute()
// Páginas sem cabeçalho do site recebem o botão de tema flutuante.
const floatingToggle = computed(() => ['/login', '/register', '/subscription', '/payment', '/conta', '/trash'].includes(route.path))
</script>

<template>
  <NuxtPage />
  <ThemeToggle v-if="floatingToggle" class="theme-toggle-floating" />
</template>
