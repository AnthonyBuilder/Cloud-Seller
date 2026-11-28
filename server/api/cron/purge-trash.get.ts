import { isTrashExpired, TRASH_ROOT } from '../../../utils/trash-keys'
import { TRASH_RETENTION_DAYS } from '../../../utils/legal'

// Tarefa diária (vercel.json) que apaga itens da lixeira com mais de TRASH_RETENTION_DAYS dias.
// Reforça a regra de ciclo de vida do bucket (veja docs/OPERACAO.md). Exige CRON_SECRET.
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: 'CRON_SECRET não configurado' })
  }
  if (getHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const client = createS3Client()
  const bucket = requireS3Bucket()
  const now = Date.now()
  const expired: string[] = []
  for (const object of await listAllKeys(client, bucket, TRASH_ROOT)) {
    const rest = object.key.slice(TRASH_ROOT.length).split('/')
    const deletedAt = Number(rest[1])
    if (Number.isFinite(deletedAt) && isTrashExpired(deletedAt, now, TRASH_RETENTION_DAYS)) {
      expired.push(object.key)
      if (expired.length >= 5000) break // limite por execução; o restante sai na próxima
    }
  }
  await deleteKeysPermanently(client, bucket, expired)
  return { purged: expired.length }
})
