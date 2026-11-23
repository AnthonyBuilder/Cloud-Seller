import {
  CognitoIdentityProviderServiceException,
  ForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const { client, clientId } = getCognitoPublicClient()

  try {
    await client.send(new ForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
    }))
    return { requested: true }
  } catch (error) {
    if (
      error instanceof CognitoIdentityProviderServiceException
      && ['UserNotFoundException', 'UserNotConfirmedException'].includes(error.name)
    ) {
      return { requested: true }
    }
    return throwCognitoServiceError(error, 'forgot-password')
  }
})
