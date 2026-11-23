export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ key?: unknown }>(event)
  const prefix = userPrefix(user.sub)

  if (typeof body.key !== 'string' || !body.key.startsWith(prefix)) {
    throw createError({ statusCode: 400, message: 'Invalid upload key' })
  }

  try {
    await extendUploadReservation(user.sub, body.key)
  } catch (error) {
    if (isConditionalCheckFailed(error)) {
      throw createError({ statusCode: 409, message: 'The upload reservation has expired' })
    }
    throw error
  }

  return { ok: true }
})
