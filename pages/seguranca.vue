<script setup lang="ts">
useHead({
  title: 'Segurança e privacidade - Cloud Seller',
  meta: [{ name: 'description', content: 'Conheça como o Cloud Seller protege o acesso às contas e separa os arquivos de cada cliente.' }],
})

const protections = [
  {
    title: 'Acesso autenticado',
    description: 'O login é validado pelo Amazon Cognito. As APIs do Cloud Seller verificam o token antes de acessar arquivos.',
    icon: 'shield' as const,
  },
  {
    title: 'Arquivos separados por conta',
    description: 'Cada conta usa um prefixo próprio no armazenamento. As operações de arquivo são limitadas a esse espaço.',
    icon: 'folder' as const,
  },
  {
    title: 'Links temporários',
    description: 'Os envios e downloads usam URLs pré-assinadas com validade limitada, em vez de credenciais AWS no navegador.',
    icon: 'clock' as const,
  },
]
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="content-hero page-wrap">
      <span class="eyebrow">PRIVACIDADE EM PRIMEIRO LUGAR</span>
      <h1>Segurança pensada em <span>camadas.</span></h1>
      <p>Autenticação, isolamento por conta e acesso temporário ajudam a proteger o caminho até seus arquivos.</p>
    </section>

    <section class="content-section page-wrap" aria-labelledby="security-title">
      <div class="content-section-heading">
        <span class="eyebrow">COMO PROTEGEMOS O ACESSO</span>
        <h2 id="security-title">Controles no login e no armazenamento.</h2>
      </div>
      <div class="info-grid">
        <article v-for="item in protections" :key="item.title" class="info-card">
          <span class="info-card-icon"><IconSymbol :name="item.icon" /></span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
        </article>
      </div>
    </section>

    <section class="content-note page-wrap security-note">
      <div>
        <span class="eyebrow">SEU PAPEL TAMBÉM IMPORTA</span>
        <h2>Cuide do acesso à sua conta.</h2>
        <p>Use uma senha forte, não compartilhe códigos de confirmação e encerre a sessão em dispositivos compartilhados. O Cloud Seller não solicita sua senha por e-mail.</p>
      </div>
      <NuxtLink class="button button-outline" to="/contato">Falar com o Cloud Seller <IconSymbol name="arrow-right" /></NuxtLink>
    </section>

    <SiteFooter />
  </main>
</template>
