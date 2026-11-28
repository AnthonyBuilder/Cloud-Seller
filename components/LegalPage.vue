<script setup lang="ts">
defineProps<{ title: string; eyebrow: string; intro: string }>()
const company = useCompany()
const updatedLabel = LEGAL_UPDATED_LABEL
const termsVersion = TERMS_VERSION
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="content-hero page-wrap">
      <span class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p>{{ intro }}</p>
      <p class="legal-meta">Última atualização: {{ updatedLabel }} · Versão {{ termsVersion }}</p>
    </section>

    <section class="legal-body page-wrap">
      <p v-if="company.isDraft" class="legal-draft" role="note">
        Documento em revisão. Os trechos entre [colchetes] ainda serão preenchidos e o texto pode mudar antes da versão final.
      </p>
      <slot />
      <p class="legal-contact">
        {{ company.name }} · CNPJ {{ company.cnpj }} · {{ company.address }}<br />
        Contato: {{ company.supportEmail }}
      </p>
    </section>

    <SiteFooter />
  </main>
</template>
