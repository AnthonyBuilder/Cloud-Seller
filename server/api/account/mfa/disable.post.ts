import { InitiateAuthCommand, SetUserMFAPreferenceCommand } from '@aws-sdk/client-cognito-identity-provider'

// Desativar exige confirmar a senha, para que uma sessão esquecida aberta não baste.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const accessToken = requireAccessToken(event, user.sub)
  const body = await readBody<{ password?: unknown }>(event) || {}
  const password = typeof body.password === 'string' ? body.password : ''
  if (!password || password.length > 256 || !user.email) {
    throw createError({ statusCode: 400, statusMessage: 'Informe sua senha para desativar.' })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    // Com MFA ativo, uma senha correta devolve o desafio de MFA (sem concluir o login).
    const check = await client.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: { USERNAME: user.email, PASSWORD: password },
    }))
    if (!check.ChallengeName && !check.AuthenticationResult) {
      throw createError({ statusCode: 401, statusMessage: 'Senha incorreta.' })
    }

    await client.send(new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false },
    }))
    return { enabled: false }
  } catch (error) {
    if (error instanceof Error && error.name === 'NotAuthorizedException') {
      throw createError({ statusCode: 401, statusMessage: 'Senha incorreta.' })
    }
    return throwCognitoServiceError(error, 'mfa-disable')
  }
})
