import { RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

// Segunda etapa do login: código de 6 dígitos do aplicativo autenticador (TOTP).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; session?: unknown; code?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const session = typeof body.session === 'string' ? body.session : ''
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : ''

  if (!session || session.length > 4096) {
    throw createError({ statusCode: 400, statusMessage: 'Sessão de verificação inválida. Entre novamente.' })
  }
  if (!/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o código de 6 dígitos do aplicativo autenticador.' })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    const result = await client.send(new RespondToAuthChallengeCommand({
      ClientId: clientId,
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      Session: session,
      ChallengeResponses: { USERNAME: email, SOFTWARE_TOKEN_MFA_CODE: code },
    }))

    const authentication = result.AuthenticationResult
    if (!authentication?.IdToken || !authentication.AccessToken) {
      // Código errado devolve uma nova sessão para tentar de novo.
      throw createError({ statusCode: 400, statusMessage: 'Não foi possível validar o código. Entre novamente.' })
    }
    return { idToken: authentication.IdToken, accessToken: authentication.AccessToken }
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAuthorizedException') {
      throw createError({ statusCode: 401, statusMessage: 'A verificação expirou. Entre novamente com e-mail e senha.' })
    }
    return throwCognitoServiceError(error, 'mfa-login')
  }
})
