import { SetUserMFAPreferenceCommand, VerifySoftwareTokenCommand } from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const accessToken = requireAccessToken(event, user.sub)
  const body = await readBody<{ code?: unknown }>(event) || {}
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : ''
  if (!/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o código de 6 dígitos do aplicativo autenticador.' })
  }

  const { client } = getCognitoPublicClient()
  try {
    const result = await client.send(new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: code,
      FriendlyDeviceName: 'Aplicativo autenticador',
    }))
    if (result.Status !== 'SUCCESS') {
      throw createError({ statusCode: 400, statusMessage: 'Código incorreto. Confira o aplicativo e tente novamente.' })
    }
    await client.send(new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    }))
    return { enabled: true }
  } catch (error) {
    return throwCognitoServiceError(error, 'mfa-verify')
  }
})
