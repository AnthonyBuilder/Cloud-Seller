import { InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!password || password.length > 256) {
    throw createError({ statusCode: 400, statusMessage: 'Informe sua senha.' })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    const result = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }))

    const authentication = result.AuthenticationResult
    if (!authentication?.IdToken || !authentication.AccessToken) {
      throw createError({
        statusCode: 409,
        message: 'A conta exige uma etapa adicional de autenticação não disponível.',
      })
    }

    return {
      idToken: authentication.IdToken,
      accessToken: authentication.AccessToken,
    }
  } catch (error) {
    return throwCognitoServiceError(error, 'login')
  }
})
