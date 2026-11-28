import { AssociateSoftwareTokenCommand } from '@aws-sdk/client-cognito-identity-provider'

// Gera o segredo TOTP para o aplicativo autenticador. A ativação só vale após confirmar um código.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const accessToken = requireAccessToken(event, user.sub)
  const { client } = getCognitoPublicClient()
  try {
    const result = await client.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }))
    if (!result.SecretCode) {
      throw createError({ statusCode: 503, statusMessage: 'Não foi possível gerar o código de configuração.' })
    }
    const label = encodeURIComponent(`Cloud Seller:${user.email || user.sub}`)
    const otpauthUri = `otpauth://totp/${label}?secret=${result.SecretCode}&issuer=${encodeURIComponent('Cloud Seller')}`
    return { secret: result.SecretCode, otpauthUri }
  } catch (error) {
    return throwCognitoServiceError(error, 'mfa-setup')
  }
})
