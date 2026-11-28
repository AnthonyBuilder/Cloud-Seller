import { GetUserCommand } from '@aws-sdk/client-cognito-identity-provider'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const accessToken = requireAccessToken(event, user.sub)
  const { client } = getCognitoPublicClient()
  try {
    const result = await client.send(new GetUserCommand({ AccessToken: accessToken }))
    return { enabled: (result.UserMFASettingList || []).includes('SOFTWARE_TOKEN_MFA') }
  } catch (error) {
    return throwCognitoServiceError(error, 'mfa-status')
  }
})
