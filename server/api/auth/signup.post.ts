import { SignUpCommand } from '@aws-sdk/client-cognito-identity-provider'
import { TERMS_VERSION } from '../../../utils/legal'
import { recordTermsAcceptance } from '../../utils/subscriptions'
import { getCognitoPublicClient, isValidCognitoPassword, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown; password?: unknown; acceptedTerms?: unknown; termsVersion?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidCognitoPassword(password)) {
    throw createError({
      statusCode: 400,
      message: 'A senha deve ter pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.',
    })
  }

  if (body.acceptedTerms !== true) {
    throw createError({
      statusCode: 400,
      message: 'Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.',
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

    // Guarda a prova do aceite (versão e data). Falha aqui não deve impedir o cadastro.
    if (result.UserSub) {
      try {
        await recordTermsAcceptance(result.UserSub, email, TERMS_VERSION)
      } catch (consentError) {
        console.error('[auth/signup] could not record terms acceptance', consentError instanceof Error ? consentError.name : 'unknown')
      }
    }

    return {
      confirmed: Boolean(result.UserConfirmed),
      destination: result.CodeDeliveryDetails?.Destination || email,
    }
  } catch (error) {
    return throwCognitoServiceError(error, 'signup')
  }
})
