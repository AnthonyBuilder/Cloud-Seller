// Regras puras da lixeira (sem dependências), compartilhadas pelo servidor e testadas em scripts/check-trash.mjs.
// Layout no bucket:
//   arquivos vivos:  users/<sub>/<caminho>
//   lixeira:         trash/<sub>/<momento-da-exclusão-em-ms>/<caminho>
// A lixeira fica fora de users/ para que uma regra de ciclo de vida do S3/R2/B2 no prefixo "trash/"
// apague tudo após TRASH_RETENTION_DAYS, e as listagens do painel nunca a misturem com os arquivos.

export const TRASH_ROOT = 'trash/'
const DAY_MS = 24 * 60 * 60 * 1000

export function trashPrefixFor(sub: string) {
  return `${TRASH_ROOT}${sub}/`
}

export function buildTrashKey(sub: string, userKey: string, deletedAt: number) {
  const prefix = `users/${sub}/`
  if (!userKey.startsWith(prefix) || userKey.endsWith('/') || userKey === prefix) {
    throw new Error('Chave fora da conta do usuário')
  }
  return `${trashPrefixFor(sub)}${Math.trunc(deletedAt)}/${userKey.slice(prefix.length)}`
}

export function parseTrashKey(sub: string, trashKey: string) {
  const prefix = trashPrefixFor(sub)
  if (!trashKey.startsWith(prefix)) return null
  const rest = trashKey.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const timestamp = rest.slice(0, slash)
  const relative = rest.slice(slash + 1)
  if (!/^\d{10,16}$/.test(timestamp) || !relative || relative.endsWith('/')) return null
  if (relative.split('/').some(part => part === '..' || part === '.')) return null
  return {
    deletedAt: Number(timestamp),
    relative,
    originalKey: `users/${sub}/${relative}`,
  }
}

// O prefixo Backups/ guarda cópias e versões do aplicativo de backup. A retenção do aplicativo
// apaga versões antigas direto (sem passar pela lixeira); qualquer outra exclusão vai para a lixeira.
export function isBackupPath(pathOrKey: string) {
  return /(^|\/)Backups\//.test(pathOrKey)
}

export function restoredName(name: string, date: Date) {
  const stamp = date.toISOString().slice(0, 10)
  const dot = name.lastIndexOf('.')
  return dot > 0
    ? `${name.slice(0, dot)} (restaurado ${stamp})${name.slice(dot)}`
    : `${name} (restaurado ${stamp})`
}

export function trashExpiresAt(deletedAt: number, retentionDays: number) {
  return deletedAt + retentionDays * DAY_MS
}

export function isTrashExpired(deletedAt: number, now: number, retentionDays: number) {
  return now >= trashExpiresAt(deletedAt, retentionDays)
}
