import { SignUpCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, isValidCognitoPassword, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidCognitoPassword(password)) {
    throw createError({
      statusCode: 400,
      message: 'A senha deve ter pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.',
    })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    const result = await client.send(new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    }))

    return {
      confirmed: Boolean(result.UserConfirmed),
      destination: result.CodeDeliveryDetails?.Destination || email,
    }
  } catch (error) {
    return throwCognitoServiceError(error, 'signup')
  }
})
