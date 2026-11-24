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
    public: {
      cognitoDomain: process.env.NUXT_PUBLIC_COGNITO_DOMAIN || '',
      cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
      cognitoRedirectUri: process.env.NUXT_PUBLIC_COGNITO_REDIRECT_URI || 'http://localhost:3000/login',
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
