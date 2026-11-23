import { ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; code?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, message: 'Informe o código de confirmação de 6 dígitos.' })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    await client.send(new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
    }))

    return { confirmed: true }
  } catch (error) {
    return throwCognitoServiceError(error, 'confirm')
  }
})
