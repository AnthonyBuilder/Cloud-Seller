export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  if (!config.public.cognitoDomain || !config.public.cognitoClientId) {
    throw createError({ statusCode: 503, statusMessage: 'Cognito is not configured' })
  }

  return {
    cognitoDomain: config.public.cognitoDomain,
    cognitoClientId: config.public.cognitoClientId,
    redirectUri: config.public.desktopRedirectUri,
  }
})
