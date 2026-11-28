<script setup lang="ts">
useHead({
  title: 'App de backup automático - Cloud Seller',
  meta: [{ name: 'description', content: 'Instale o app do Cloud Seller e faça backup automático das suas pastas durante a noite, sem precisar lembrar.' }],
})

const config = useRuntimeConfig()
const base = String(config.public.desktopDownloadBase).replace(/\/$/, '')
const releasesUrl = String(config.public.desktopReleasesUrl)

const downloads = [
  { os: 'Windows', detail: 'Windows 10 ou 11', file: 'Cloud-Seller-Backup-Setup.exe', note: 'Instalador (.exe)' },
  { os: 'macOS', detail: 'Intel e Apple Silicon', file: 'Cloud-Seller-Backup.dmg', note: 'Imagem de disco (.dmg)' },
  { os: 'Linux', detail: 'Distribuições com AppImage', file: 'Cloud-Seller-Backup.AppImage', note: 'AppImage' },
].map(item => ({ ...item, href: `${base}/${item.file}` }))
</script>

<template>
  <main class="site-content-page">
    <SiteHeader />

    <section class="content-hero page-wrap">
      <span class="eyebrow">APP DE BACKUP</span>
      <h1>Backup automático, <span>enquanto você dorme.</span></h1>
      <p>Escolha as pastas uma vez. O app envia o que mudou para a sua nuvem toda noite, guarda versões antigas e deixa você restaurar quando precisar.</p>
    </section>

    <section class="backup-downloads page-wrap" aria-labelledby="download-title">
      <h2 id="download-title" class="sr-only">Baixar o aplicativo</h2>
      <article v-for="item in downloads" :key="item.os" class="backup-download-card">
        <h3>{{ item.os }}</h3>
        <p>{{ item.detail }}</p>
        <a class="button button-primary" :href="item.href" rel="noopener">
          Baixar para {{ item.os }} <IconSymbol name="arrow-right" />
        </a>
        <small>{{ item.note }}</small>
      </article>
    </section>
    <p class="backup-all page-wrap">
      Precisa de outra versão? <a :href="releasesUrl" rel="noopener">Veja todas as versões</a>.
    </p>

    <section class="backup-steps page-wrap" aria-labelledby="steps-title">
      <h2 id="steps-title">Como configurar em 3 minutos</h2>
      <ol>
        <li><strong>Instale e abra o app.</strong> Ele fica na bandeja do sistema e inicia junto com o computador.</li>
        <li><strong>Entre com sua conta Cloud Seller.</strong> Se você ativou a verificação em duas etapas, ela será pedida nesse login.</li>
        <li><strong>Adicione as pastas</strong> que quer proteger (Documentos, Fotos, projetos...) e confira o horário do backup noturno. O padrão é 02:00.</li>
      </ol>
    </section>

    <section class="backup-details page-wrap" aria-labelledby="details-title">
      <h2 id="details-title">O que acontece no seu backup</h2>
      <ul>
        <li><strong>Durante o dia:</strong> arquivos novos ou alterados são enviados logo depois de salvos (opcional).</li>
        <li><strong>Toda noite:</strong> o app confere todas as pastas, envia o que mudou e guarda uma versão diária dos arquivos alterados.</li>
        <li><strong>Histórico:</strong> as versões antigas são mantidas por 30 dias por padrão (você ajusta de 7 a 365 dias) e depois removidas automaticamente.</li>
        <li><strong>Restaurar:</strong> abra o app, escolha os arquivos e a pasta de destino. A estrutura original é preservada.</li>
        <li><strong>Computador desligado de madrugada?</strong> O backup roda assim que ele ligar e o app abrir.</li>
      </ul>
      <p class="backup-note">
        O backup usa o espaço do seu plano: a cópia atual e as versões do histórico contam na cota. Arquivos apagados do computador continuam na cópia da nuvem.
      </p>
    </section>

    <section class="backup-details page-wrap" aria-labelledby="warning-title">
      <h2 id="warning-title">Aviso de segurança ao instalar</h2>
      <p>
        Se o Windows (SmartScreen) ou o macOS (Gatekeeper) avisar que o aplicativo não foi reconhecido, é porque a assinatura digital do instalador ainda não foi emitida.
        Baixe apenas desta página. No Windows, clique em "Mais informações" e depois em "Executar assim mesmo". No macOS, abra com clique direito e escolha "Abrir".
      </p>
    </section>

    <section class="content-note page-wrap">
      <div>
        <span class="eyebrow">AINDA NÃO TEM CONTA?</span>
        <h2>Comece com o teste gratuito.</h2>
        <p>Crie sua conta e conheça o armazenamento antes de assinar.</p>
      </div>
      <NuxtLink class="button button-primary" to="/register">Criar conta <IconSymbol name="arrow-right" /></NuxtLink>
    </section>

    <SiteFooter />
  </main>
</template>
