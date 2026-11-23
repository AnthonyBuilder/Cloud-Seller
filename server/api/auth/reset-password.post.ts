import { ConfirmForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider'
import {
  getCognitoPublicClient,
  isValidCognitoPassword,
  normalizeCognitoEmail,
  throwCognitoServiceError,
} from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; code?: unknown; password?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, message: 'Informe o código de redefinição de 6 dígitos.' })
  }
  if (!isValidCognitoPassword(password)) {
    throw createError({
      statusCode: 400,
      message: 'A senha deve ter pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.',
    })
  }

  const { client, clientId } = getCognitoPublicClient()
  try {
    await client.send(new ConfirmForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      Password: password,
    }))
    return { reset: true }
  } catch (error) {
    return throwCognitoServiceError(error, 'reset-password')
  }
})
