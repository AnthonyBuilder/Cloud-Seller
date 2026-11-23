<script setup lang="ts">
useHead({
  title: 'Contato - Cloud Seller',
  meta: [{ name: 'description', content: 'Entre em contato com a equipe do Cloud Seller.' }],
})

const supportEmail = 'cloudseller@icloud.com'
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="contact-panel page-wrap">
      <span class="eyebrow">ESTAMOS À DISPOSIÇÃO</span>
      <h1>Vamos conversar?</h1>
      <p>Envie sua dúvida sobre cadastro, acesso ou armazenamento. Não inclua senhas, códigos de confirmação ou outros dados de acesso no e-mail.</p>
      <a class="contact-email" :href="`mailto:${supportEmail}?subject=Contato%20Cloud%20Seller`">
        {{ supportEmail }}
      </a>
      <a class="button button-primary" :href="`mailto:${supportEmail}?subject=Contato%20Cloud%20Seller`">
        Escrever um e-mail <IconSymbol name="arrow-right" />
      </a>
      <p class="contact-response-note">O link abre o aplicativo de e-mail configurado no seu dispositivo.</p>
    </section>

    <SiteFooter />
  </main>
</template>
