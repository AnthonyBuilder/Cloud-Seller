export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const clientId = process.env.COGNITO_CLIENT_ID || config.public.cognitoClientId
  if (!config.public.cognitoDomain || !clientId) {
    throw createError({ statusCode: 503, statusMessage: 'Cognito is not configured' })
  }

  return {
    cognitoDomain: config.public.cognitoDomain,
    cognitoClientId: clientId,
    redirectUri: config.public.desktopRedirectUri,
  }
})
