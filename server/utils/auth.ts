import { createRemoteJWKSet, jwtVerify } from 'jose'

export async function requireUser(event: Parameters<typeof getHeader>[0]) {
  const config = useRuntimeConfig()
  const authorization = getHeader(event, 'authorization')

  if (!config.cognitoUserPoolId) {
    throw createError({ statusCode: 503, statusMessage: 'Cognito is not configured' })
  }

  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const token = authorization.slice('Bearer '.length)
  const region = config.cognitoRegion
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${config.cognitoUserPoolId}`
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.cognitoClientId || undefined,
    })

    if (!payload.sub) {
      throw new Error('Missing subject')
    }

    return {
      sub: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : '',
    }
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' })
  }
}

export function safeFolder(folder: unknown) {
  const value = typeof folder === 'string' ? folder : '/'
  const parts = value
    .split('/')
    .filter(Boolean)
    .filter(part => part !== '.' && part !== '..')
    .map(part => part.replace(/[^\p{L}\p{N}._ -]/gu, '-'))

  return parts.length ? `/${parts.join('/')}/` : '/'
}

export function userPrefix(sub: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(sub)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user identifier' })
  }
  return `users/${sub}/`
}
