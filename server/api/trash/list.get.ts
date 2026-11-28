import { trashExpiresAt } from '../../../utils/trash-keys'
import { TRASH_RETENTION_DAYS } from '../../../utils/legal'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const items = await listTrashItems(createS3Client(), requireS3Bucket(), user.sub)
  return {
    retentionDays: TRASH_RETENTION_DAYS,
    totalBytes: items.reduce((total, item) => total + item.size, 0),
    items: items.map(item => ({
      key: item.key,
      name: item.relative.split('/').pop() || item.relative,
      path: `/${item.relative}`,
      size: item.size,
      deletedAt: new Date(item.deletedAt).toISOString(),
      expiresAt: new Date(trashExpiresAt(item.deletedAt, TRASH_RETENTION_DAYS)).toISOString(),
    })),
  }
})
