// Regras puras do agendamento e da retenção do backup (testadas em scripts/check-backup.cjs).

function dayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseBackupTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''))
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: 2, minute: 0 }
}

function normalizeBackupTime(value) {
  const { hour, minute } = parseBackupTime(value)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function daysBetween(fromKey, toKey) {
  const parse = key => {
    const [y, m, d] = key.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000)
}

// Roda o backup noturno quando: ainda não rodou hoje E (já passou do horário escolhido OU o
// computador ficou desligado por uma noite inteira ou mais e precisa recuperar o atraso).
// Se o computador estava desligado no horário, o backup roda assim que ele ligar e o app abrir.
function shouldRunNightlyBackup({ now = new Date(), lastDailyBackup, backupTime }) {
  const today = dayKey(now)
  if (lastDailyBackup === today) return false
  const { hour, minute } = parseBackupTime(backupTime)
  if (now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute) return true
  return Boolean(lastDailyBackup) && daysBetween(lastDailyBackup, today) >= 2
}

function nextNightlyRun({ now = new Date(), lastDailyBackup, backupTime }) {
  if (shouldRunNightlyBackup({ now, lastDailyBackup, backupTime })) return now
  const { hour, minute } = parseBackupTime(backupTime)
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next <= now || lastDailyBackup === dayKey(now)) next.setDate(next.getDate() + 1)
  return next
}

function normalizeRetentionDays(value) {
  const days = Math.trunc(Number(value))
  if (!Number.isFinite(days)) return 30
  return Math.min(Math.max(days, 7), 365)
}

// Pastas Daily/AAAA-MM-DD mais antigas que o período de retenção. Ignora qualquer nome fora do padrão.
function snapshotsToDelete(folderNames, today, retentionDays) {
  const limit = normalizeRetentionDays(retentionDays)
  return folderNames.filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name) && daysBetween(name, today) > limit)
}

module.exports = {
  dayKey,
  daysBetween,
  nextNightlyRun,
  normalizeBackupTime,
  normalizeRetentionDays,
  parseBackupTime,
  shouldRunNightlyBackup,
  snapshotsToDelete,
}
