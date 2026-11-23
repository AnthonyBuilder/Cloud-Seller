<template>
  <footer class="site-footer page-wrap">
    <div class="footer-main">
      <NuxtLink class="brand footer-brand" to="/" aria-label="Cloud Seller, início">
        <span class="brand-mark" aria-hidden="true"><IconSymbol name="cloud-upload" /></span>
        <span>cloud seller<span class="brand-dot">.</span></span>
      </NuxtLink>
      <p>Um lugar simples para guardar e acessar seus arquivos.</p>
    </div>
    <nav class="footer-links" aria-label="Links institucionais">
      <NuxtLink to="/como-funciona">Como funciona</NuxtLink>
      <NuxtLink to="/seguranca">Segurança</NuxtLink>
      <NuxtLink to="/sobre">Sobre</NuxtLink>
      <NuxtLink to="/contato">Contato</NuxtLink>
      <NuxtLink to="/login">Entrar</NuxtLink>
    </nav>
    <span class="footer-copyright">© 2026 Cloud Seller.</span>
  </footer>
</template>
