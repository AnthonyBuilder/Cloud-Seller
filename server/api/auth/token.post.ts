export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ code?: string }>(event)
  if (!body.code || !config.public.cognitoDomain || !config.public.cognitoClientId) {
    throw createError({ statusCode: 400, statusMessage: 'Cognito configuration is incomplete' })
  }

  const tokenUrl = `https://${config.public.cognitoDomain}/oauth2/token`
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.public.cognitoClientId,
    code: body.code,
    redirect_uri: config.public.cognitoRedirectUri,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!response.ok) {
    throw createError({ statusCode: 401, statusMessage: 'Unable to exchange Cognito authorization code' })
  }

  const tokens = await response.json() as {
    id_token?: string
    access_token?: string
  }
  if (!tokens.id_token) {
    throw createError({ statusCode: 401, statusMessage: 'Cognito did not return an ID token' })
  }

  return tokens
})
