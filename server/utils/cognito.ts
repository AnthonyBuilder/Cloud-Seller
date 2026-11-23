import {
  CognitoIdentityProviderClient,
  CognitoIdentityProviderServiceException,
} from '@aws-sdk/client-cognito-identity-provider'

const cognitoErrors: Record<string, { statusCode: number; statusMessage: string }> = {
  AliasExistsException: {
    statusCode: 409,
    statusMessage: 'Já existe uma conta usando este e-mail.',
  },
  CodeDeliveryFailureException: {
    statusCode: 503,
    statusMessage: 'Não foi possível enviar o código de confirmação. Tente novamente mais tarde.',
  },
  CodeMismatchException: {
    statusCode: 400,
    statusMessage: 'O código informado está incorreto.',
  },
  ExpiredCodeException: {
    statusCode: 400,
    statusMessage: 'O código expirou. Solicite um novo código.',
  },
  InvalidParameterException: {
    statusCode: 400,
    statusMessage: 'Confira o e-mail e os dados informados.',
  },
  InvalidPasswordException: {
    statusCode: 400,
    statusMessage: 'A senha deve ter pelo menos 12 caracteres, com letras maiúsculas, minúsculas e números.',
  },
  LimitExceededException: {
    statusCode: 429,
    statusMessage: 'Muitas tentativas. Aguarde antes de solicitar outro código.',
  },
  NotAuthorizedException: {
    statusCode: 400,
    statusMessage: 'A conta já pode estar confirmada. Tente entrar ou solicite um novo código.',
  },
  TooManyRequestsException: {
    statusCode: 429,
    statusMessage: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
  UserNotFoundException: {
    statusCode: 400,
    statusMessage: 'Não foi possível confirmar essa conta. Confira o e-mail ou tente entrar.',
  },
  UsernameExistsException: {
    statusCode: 409,
    statusMessage: 'Já existe uma conta com este e-mail. Tente entrar.',
  },
}

export function getCognitoPublicClient() {
  const config = useRuntimeConfig()
  if (!config.cognitoClientId || !config.cognitoRegion) {
    throw createError({ statusCode: 503, statusMessage: 'O cadastro está temporariamente indisponível.' })
  }

  return {
    client: new CognitoIdentityProviderClient({ region: config.cognitoRegion }),
    clientId: String(config.cognitoClientId),
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

  const response = cognitoErrors[error.name]
  if (response) {
    throw createError(response)
  }

  console.error(`[auth/${operation}] Cognito request failed`, {
    errorName: error.name,
    requestId: error.$metadata.requestId,
  })
  throw createError({
    statusCode: 503,
    statusMessage: 'O Cognito não conseguiu concluir a solicitação. Tente novamente mais tarde.',
  })
}
