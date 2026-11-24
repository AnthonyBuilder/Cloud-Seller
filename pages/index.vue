<script setup lang="ts">
useHead({
  title: 'Cloud Seller',
  meta: [
    { name: 'description', content: 'Cloud Seller - seus arquivos seguros e sempre ao seu alcance.' },
  ],
})

const plans = [
  {
    id: 'essencial',
    name: 'Essencial',
    description: 'Para guardar o que importa.',
    storage: '100 GB',
    priceUsd: 'US$ 7.67',
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Mais espaço para sua rotina.',
    storage: '500 GB',
    priceUsd: 'US$ 38.33',
    featured: true,
  },
  {
    id: 'familia',
    name: 'Família',
    description: 'Espaço para todo mundo.',
    storage: '1 TB',
    priceUsd: 'US$ 76.67',
    featured: false,
  },
]
</script>

<template>
  <main class="home-page">
    <SiteHeader />

    <section class="hero page-wrap">
      <div class="hero-copy">
        <div class="eyebrow"><span class="status-dot" /> SEUS ARQUIVOS, EM UM SÓ LUGAR</div>
        <h1>Seus arquivos,<br /><span>sempre à mão.</span></h1>
        <p class="hero-description">
          Guarde fotos, documentos e projetos com segurança — e acesse tudo de onde estiver.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#planos">
            Encontrar meu plano
            <IconSymbol name="arrow-right" />
          </a>
          <a class="text-link" href="#beneficios">Conheça a nuvem <IconSymbol name="arrow-down" /></a>
        </div>
        <div class="social-proof">
          <div class="avatar-stack" aria-hidden="true">
            <span>MA</span><span>LC</span><span>JP</span><span>+</span>
          </div>
          <p><strong>Simples de usar.</strong><br />Feita para acompanhar você.</p>
        </div>
      </div>

      <div class="hero-art" aria-label="Ilustração de arquivos guardados na nuvem">
        <div class="orbit orbit-one" />
        <div class="orbit orbit-two" />
        <div class="floating-card file-card">
          <span class="file-icon photo-icon">
            <IconSymbol name="photo" />
          </span>
          <span><strong>Momentos.jpg</strong><small>4,8 MB · agora</small></span>
          <span class="check-mark" aria-label="Sincronizado"><IconSymbol name="check" /></span>
        </div>
        <div class="cloud-illustration">
          <div class="cloud-shadow" />
          <svg viewBox="0 0 300 220" fill="none" aria-hidden="true" focusable="false">
            <path d="M67 176h164c25 0 45-20 45-45 0-24-18-43-42-45-10-33-41-57-77-57-32 0-60 19-72 47-5-2-11-3-17-3-25 0-45 20-45 45 0 32 19 58 44 58Z" fill="url(#cloudFill)" stroke="#C5DDF8" stroke-opacity=".9" stroke-width="2.5" stroke-linejoin="round" />
            <path d="M116 157h68m-34-16V88m0 0-23 23m23-23 23 23" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
            <defs>
              <linearGradient id="cloudFill" x1="72" y1="42" x2="240" y2="184" gradientUnits="userSpaceOnUse">
                <stop stop-color="#5D94CC" stop-opacity=".45" />
                <stop offset="1" stop-color="#D2E8FF" stop-opacity=".12" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="floating-card storage-card">
          <span class="storage-symbol"><IconSymbol name="cloud-check" /></span>
          <span><strong>Tudo sincronizado</strong><small>Seus arquivos estão seguros</small></span>
          <span class="online-dot" />
        </div>
        <div class="art-caption"><span class="caption-line" /> Acesse de onde estiver</div>
      </div>
    </section>

    <section id="beneficios" class="benefits page-wrap">
      <div class="section-heading">
        <span class="eyebrow">DO SEU JEITO</span>
        <h2>Armazenar pode ser <span>simples.</span></h2>
      </div>
      <div class="benefit-grid">
        <article class="benefit-item">
          <span class="benefit-icon violet-icon"><IconSymbol name="laptop" /></span>
          <h3>Acesse em qualquer lugar</h3>
          <p>Seus arquivos sempre à mão, no celular ou no computador.</p>
        </article>
        <article id="seguranca" class="benefit-item">
          <span class="benefit-icon blue-icon"><IconSymbol name="shield" /></span>
          <h3>Privacidade em primeiro lugar</h3>
          <p>Seus arquivos são seus. Guarde tudo com tranquilidade.</p>
        </article>
        <article class="benefit-item">
          <span class="benefit-icon peach-icon"><IconSymbol name="hard-drive" /></span>
          <h3>Mais espaço para viver</h3>
          <p>Libere espaço nos seus dispositivos sem apagar suas memórias.</p>
        </article>
      </div>
    </section>

    <section class="steps-section page-wrap">
      <div class="section-heading">
        <span class="eyebrow">COMECE COM TRANQUILIDADE</span>
        <h2>Três passos até seus arquivos.</h2>
        <p>Do cadastro ao primeiro envio, você acompanha cada etapa.</p>
      </div>
      <div class="steps-grid">
        <article class="info-card step-card">
          <div class="step-card-top">
            <span class="step-number">01</span>
            <span class="info-card-icon"><IconSymbol name="share" /></span>
          </div>
          <h3>Crie sua conta</h3>
          <p>Cadastre seu e-mail e confirme o código enviado para começar.</p>
        </article>
        <article class="info-card step-card">
          <div class="step-card-top">
            <span class="step-number">02</span>
            <span class="info-card-icon"><IconSymbol name="hard-drive" /></span>
          </div>
          <h3>Escolha seu espaço</h3>
          <p>Selecione a capacidade que acompanha sua rotina e comece a guardar seus arquivos.</p>
        </article>
        <article class="info-card step-card">
          <div class="step-card-top">
            <span class="step-number">03</span>
            <span class="info-card-icon"><IconSymbol name="cloud-upload" /></span>
          </div>
          <h3>Organize seus arquivos</h3>
          <p>Envie arquivos, crie pastas e baixe o que precisar pelo painel.</p>
        </article>
      </div>
      <NuxtLink class="text-link steps-link" to="/como-funciona">
        Veja todos os detalhes <IconSymbol name="arrow-right" />
      </NuxtLink>
    </section>

    <section id="planos" class="plans-section">
      <div class="page-wrap">
        <div class="section-heading plans-heading">
          <span class="eyebrow">PLANOS PARA VOCÊ</span>
          <h2>Escolha seu espaço.</h2>
          <p>Sem complicação. Encontre o tamanho certo para sua vida.</p>
        </div>
        <div class="plan-grid">
          <article
            v-for="plan in plans"
            :key="plan.name"
            class="plan-card"
            :class="{ 'plan-featured': plan.featured }"
          >
            <span v-if="plan.featured" class="popular-label">MAIS ESCOLHIDO</span>
            <h3>{{ plan.name }}</h3>
            <p class="plan-description">{{ plan.description }}</p>
            <p class="plan-price">{{ plan.priceUsd }}<small>/mês</small></p>
            <div class="plan-storage"><IconSymbol name="cloud-upload" /> {{ plan.storage }} de armazenamento</div>
            <NuxtLink class="button" :class="plan.featured ? 'button-primary' : 'button-plan'" to="/register">
              Criar conta <IconSymbol name="arrow-right" />
            </NuxtLink>
            <p class="plan-note">Plano de armazenamento</p>
          </article>
        </div>
        <aside class="backup-addon" aria-labelledby="backup-addon-title">
          <div class="backup-addon-icon">
            <IconSymbol name="cloud-check" />
          </div>
          <div class="backup-addon-copy">
            <span class="eyebrow">ADICIONAL OPCIONAL</span>
            <h3 id="backup-addon-title">Backup automático</h3>
            <p>
              Uma camada extra de proteção, com cópias programadas dos seus arquivos
              e opção de recuperação quando precisar.
            </p>
            <div class="backup-addon-benefits">
              <span><IconSymbol name="clock" /> Cópias programadas</span>
              <span><IconSymbol name="shield" /> Proteção adicional</span>
            </div>
          </div>
          <div class="backup-addon-action">
            <span>Disponibilidade e condições sob consulta</span>
            <a
              class="button button-addon"
              href="mailto:cloudseller@icloud.com?subject=Interesse%20em%20backup%20autom%C3%A1tico"
            >
              Tenho interesse <IconSymbol name="arrow-right" />
            </a>
          </div>
        </aside>
        <p class="plans-footnote">As capacidades usam unidades decimais. Os valores e condições comerciais serão definidos antes da ativação das cobranças.</p>
      </div>
    </section>

    <section class="closing page-wrap">
      <div>
        <span class="eyebrow">SEU PRÓXIMO PASSO</span>
        <h2>Seus arquivos merecem<br />um lugar especial.</h2>
      </div>
      <a class="button button-light" href="#planos">Ver planos <IconSymbol name="arrow-right" /></a>
    </section>

    <SiteFooter />
  </main>
</template>
