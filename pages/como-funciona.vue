<script setup lang="ts">
useHead({
  title: 'Como funciona - Cloud Seller',
  meta: [{ name: 'description', content: 'Veja como criar sua conta, escolher o armazenamento e guardar arquivos no Cloud Seller.' }],
})

const steps = [
  {
    number: '01',
    title: 'Crie sua conta',
    description: 'Cadastre seu e-mail, confirme o código enviado e entre pelo Cloud Seller.',
    icon: 'share' as const,
  },
  {
    number: '02',
    title: 'Escolha seu espaço',
    description: 'Selecione 100 GB, 500 GB ou 1 TB.',
    icon: 'hard-drive' as const,
  },
  {
    number: '03',
    title: 'Envie e organize',
    description: 'Crie pastas, envie arquivos e baixe-os novamente pelo painel da sua conta.',
    icon: 'cloud-upload' as const,
  },
]
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="content-hero page-wrap">
      <span class="eyebrow">SIMPLES DESDE O PRIMEIRO DIA</span>
      <h1>Seus arquivos, em <span>poucos passos.</span></h1>
      <p>Crie sua conta, escolha o espaço e acesse seus arquivos pelo painel do Cloud Seller.</p>
      <NuxtLink class="button button-primary" to="/register">Criar minha conta <IconSymbol name="arrow-right" /></NuxtLink>
    </section>

    <section class="content-section page-wrap" aria-labelledby="steps-title">
      <div class="content-section-heading">
        <span class="eyebrow">COMO COMEÇAR</span>
        <h2 id="steps-title">Do cadastro aos seus arquivos.</h2>
      </div>
      <div class="steps-grid">
        <article v-for="step in steps" :key="step.number" class="info-card step-card">
          <div class="step-card-top">
            <span class="step-number">{{ step.number }}</span>
            <span class="info-card-icon"><IconSymbol :name="step.icon" /></span>
          </div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
        </article>
      </div>
    </section>

    <section class="content-note page-wrap">
      <div>
        <span class="eyebrow">ANTES DE ESCOLHER</span>
        <h2>Escolha o espaço certo.</h2>
        <p>Compare os planos disponíveis e selecione a capacidade que atende à sua rotina. Seus arquivos permanecem disponíveis pelo painel da conta.</p>
      </div>
      <NuxtLink class="button button-outline" to="/#planos">Conhecer os planos <IconSymbol name="arrow-right" /></NuxtLink>
    </section>

    <SiteFooter />
  </main>
</template>
