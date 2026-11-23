import { ResendConfirmationCodeCommand } from '@aws-sdk/client-cognito-identity-provider'
import { getCognitoPublicClient, normalizeCognitoEmail, throwCognitoServiceError } from '../../utils/cognito'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown }>(event) || {}
  const email = normalizeCognitoEmail(body.email)
  const { client, clientId } = getCognitoPublicClient()

  try {
    const result = await client.send(new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: email,
    }))

    return {
      destination: result.CodeDeliveryDetails?.Destination || email,
    }
  } catch (error) {
    return throwCognitoServiceError(error, 'resend')
  }
})
