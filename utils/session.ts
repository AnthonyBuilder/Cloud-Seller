const SESSION_KEYS = [
  'cloud-seller-session',
  'cloud-seller-id-token',
  'cloud-seller-access-token',
]

export function isJwtExpired(token: string) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return true

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))) as { exp?: unknown }
    return typeof decoded.exp !== 'number' || decoded.exp <= Date.now() / 1000 + 30
  } catch {
    return true
  }
}

export function clearStoredSession() {
  for (const key of SESSION_KEYS) {
    localStorage.removeItem(key)
  }
}

export function isUnauthorizedError(caught: unknown) {
  if (typeof caught !== 'object' || caught === null) return false
  const error = caught as Record<string, unknown>
  const data = typeof error.data === 'object' && error.data !== null
    ? error.data as Record<string, unknown>
    : undefined
  return error.statusCode === 401
    || error.status === 401
    || data?.statusCode === 401
    || data?.status === 401
}
