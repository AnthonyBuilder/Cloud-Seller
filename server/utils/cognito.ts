import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderServiceException,
} from '@aws-sdk/client-cognito-identity-provider'

const cognitoErrors: Record<string, { statusCode: number; message: string }> = {
  AliasExistsException: {
    statusCode: 409,
    message: 'Já existe uma conta usando este e-mail.',
  },
  CodeDeliveryFailureException: {
    statusCode: 503,
    message: 'Não foi possível enviar o código de confirmação. Tente novamente mais tarde.',
  },
  CodeMismatchException: {
    statusCode: 400,
    message: 'O código informado está incorreto.',
  },
  ExpiredCodeException: {
    statusCode: 400,
    message: 'O código expirou. Solicite um novo código.',
  },
  InvalidParameterException: {
    statusCode: 400,
    message: 'Confira o e-mail e os dados informados.',
  },
  InvalidPasswordException: {
    statusCode: 400,
    message: 'A senha deve ter pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.',
  },
  LimitExceededException: {
    statusCode: 429,
    message: 'Muitas tentativas. Aguarde antes de solicitar outro código.',
  },
  NotAuthorizedException: {
    statusCode: 400,
    message: 'A conta já pode estar confirmada. Tente entrar ou solicite um novo código.',
  },
  PasswordResetRequiredException: {
    statusCode: 403,
    message: 'É necessário redefinir sua senha antes de entrar.',
  },
  TooManyRequestsException: {
    statusCode: 429,
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
  UserNotConfirmedException: {
    statusCode: 403,
    message: 'Confirme seu e-mail antes de entrar.',
  },
  UserNotFoundException: {
    statusCode: 400,
    message: 'Não foi possível confirmar essa conta. Confira o e-mail ou tente entrar.',
  },
  UsernameExistsException: {
    statusCode: 409,
    message: 'Já existe uma conta com este e-mail. Tente entrar.',
  },
}

export function getCognitoPublicClient() {
  const config = useRuntimeConfig()
  const clientId = process.env.COGNITO_CLIENT_ID || config.cognitoClientId
  const region = process.env.COGNITO_REGION || config.cognitoRegion
  if (!clientId || !region) {
    throw createError({ statusCode: 503, message: 'A autenticação está temporariamente indisponível.' })
  }

  return {
    client: new CognitoIdentityProviderClient({ region }),
    clientId: String(clientId),
  }
}

export function normalizeCognitoEmail(value: unknown) {
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Informe um e-mail válido.' })
  }

  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um e-mail válido.' })
  }

  return email
}

export function throwCognitoServiceError(error: unknown, operation: string): never {
  if (!(error instanceof CognitoIdentityProviderServiceException)) {
    throw error
  }

  const response = operation === 'login' && error.name === 'NotAuthorizedException'
    ? { statusCode: 401, message: 'E-mail ou senha incorretos.' }
    : cognitoErrors[error.name]
  if (response) {
    throw createError({
      ...response,
      ...(error.name === 'UserNotConfirmedException' ? { data: { code: 'USER_NOT_CONFIRMED' } } : {}),
    })
  }

  console.error(`[auth/${operation}] Cognito request failed`, {
    errorName: error.name,
    requestId: error.$metadata.requestId,
  })
  throw createError({
    statusCode: 503,
    message: 'O Cognito não conseguiu concluir a solicitação. Tente novamente mais tarde.',
  })
}
