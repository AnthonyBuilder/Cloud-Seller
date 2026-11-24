<script setup lang="ts">
useHead({
  title: 'Sobre - Cloud Seller',
  meta: [{ name: 'description', content: 'Conheça o Cloud Seller, um serviço para guardar e organizar arquivos online.' }],
})
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="content-hero page-wrap">
      <span class="eyebrow">SOBRE O CLOUD SELLER</span>
      <h1>Mais clareza para cuidar dos seus <span>arquivos.</span></h1>
      <p>O Cloud Seller reúne armazenamento online, organização em pastas e acesso aos arquivos em um painel simples.</p>
    </section>

    <section class="about-story page-wrap">
      <article class="about-copy">
        <span class="eyebrow">NOSSA PROPOSTA</span>
        <h2>Um lugar para guardar o que faz parte da sua rotina.</h2>
        <p>Fotos, documentos e projetos se acumulam em diferentes dispositivos. O Cloud Seller foi pensado para ajudar você a organizá-los em um único espaço e acessá-los quando precisar.</p>
        <p>Você escolhe a capacidade de armazenamento e controla seus arquivos pelo painel: pode criar pastas, enviar, baixar e excluir conteúdo.</p>
      </article>
      <aside class="about-highlight">
        <span class="info-card-icon"><IconSymbol name="cloud-check" /></span>
        <h3>Feito para ser direto</h3>
        <p>Sem condições ocultas: os planos disponíveis têm 100 GB, 500 GB ou 1 TB de armazenamento.</p>
        <NuxtLink class="text-link" to="/como-funciona">Veja como funciona <IconSymbol name="arrow-right" /></NuxtLink>
      </aside>
    </section>

    <section class="content-note page-wrap">
      <div>
        <span class="eyebrow">QUER CONHECER?</span>
        <h2>Comece pelo espaço que combina com você.</h2>
        <p>Compare as capacidades disponíveis e crie sua conta quando estiver pronto.</p>
      </div>
      <NuxtLink class="button button-primary" to="/#planos">Ver planos <IconSymbol name="arrow-right" /></NuxtLink>
    </section>

    <SiteFooter />
  </main>
</template>
