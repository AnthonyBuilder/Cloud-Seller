export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  devtools: { enabled: true },
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    cognitoRegion: process.env.COGNITO_REGION || 'us-east-1',
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3Endpoint: process.env.S3_ENDPOINT || '',
    s3Bucket: process.env.S3_BUCKET || '',
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    dynamodbTable: process.env.DYNAMODB_TABLE || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
    public: {
      cognitoDomain: process.env.NUXT_PUBLIC_COGNITO_DOMAIN || '',
      cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
      cognitoRedirectUri: process.env.NUXT_PUBLIC_COGNITO_REDIRECT_URI || 'http://localhost:3000/login',
      priceBook: process.env.NUXT_PUBLIC_PRICE_BOOK || 'seguro',
      // Dados legais exibidos nas páginas Termos, Privacidade e Reembolso e no rodapé.
      companyName: process.env.NUXT_PUBLIC_COMPANY_NAME || '',
      companyCnpj: process.env.NUXT_PUBLIC_COMPANY_CNPJ || '',
      companyAddress: process.env.NUXT_PUBLIC_COMPANY_ADDRESS || '',
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || '',
      dpoEmail: process.env.NUXT_PUBLIC_DPO_EMAIL || '',
      // Enquanto "true", as páginas legais exibem o aviso de rascunho. Mude para "false" após revisão jurídica.
      legalDraft: process.env.NUXT_PUBLIC_LEGAL_DRAFT !== 'false',
      // Base dos downloads do app de backup (GitHub Releases).
      desktopDownloadBase: process.env.NUXT_PUBLIC_DESKTOP_DOWNLOAD_BASE || 'https://github.com/AnthonyBuilder/Cloud-Seller/releases/latest/download',
      desktopReleasesUrl: process.env.NUXT_PUBLIC_DESKTOP_RELEASES_URL || 'https://github.com/AnthonyBuilder/Cloud-Seller/releases/latest',
      enableEur: process.env.NUXT_PUBLIC_ENABLE_EUR === 'true',
      desktopRedirectUri: process.env.NUXT_PUBLIC_DESKTOP_REDIRECT_URI || 'http://localhost:53682/callback',
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  nitro: {
    preset: 'vercel',
    externals: {
      inline: ['unhead', 'parse5', 'entities'],
    },
  },
})
