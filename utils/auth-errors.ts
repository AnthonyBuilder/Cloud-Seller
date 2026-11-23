export function getAuthError(caught: unknown, fallback: string) {
  if (typeof caught !== 'object' || caught === null) {
    return { message: fallback, code: undefined }
  }

  const error = caught as Record<string, unknown>
  const data = typeof error.data === 'object' && error.data !== null
    ? error.data as Record<string, unknown>
    : undefined
  const details = typeof data?.data === 'object' && data.data !== null
    ? data.data as Record<string, unknown>
    : data

  return {
    message: typeof data?.message === 'string'
        ? data.message
        : typeof data?.statusMessage === 'string'
          ? data.statusMessage
          : typeof error.message === 'string'
            ? error.message
            : typeof error.statusMessage === 'string'
              ? error.statusMessage
              : fallback,
    code: typeof details?.code === 'string' ? details.code : undefined,
  }
}
