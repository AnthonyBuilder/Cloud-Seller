import assert from 'node:assert/strict'
import { buildTrashKey, isBackupPath, isTrashExpired, parseTrashKey, restoredName, trashExpiresAt, trashPrefixFor } from '../utils/trash-keys.ts'

const sub = 'abc-123_X'
const at = 1_764_000_000_000
const key = `users/${sub}/Fotos/2026/viagem.jpg`
const trashed = buildTrashKey(sub, key, at)
assert.equal(trashed, `trash/${sub}/${at}/Fotos/2026/viagem.jpg`)
assert.ok(trashed.startsWith(trashPrefixFor(sub)))
assert.deepEqual(parseTrashKey(sub, trashed), { deletedAt: at, relative: 'Fotos/2026/viagem.jpg', originalKey: key })
// ida e volta preserva o caminho original
assert.equal(parseTrashKey(sub, buildTrashKey(sub, `users/${sub}/a.txt`, at))?.originalKey, `users/${sub}/a.txt`)

// segurança: outro usuário, pastas, caminhos suspeitos e lixo
assert.throws(() => buildTrashKey(sub, 'users/outro/a.txt', at))
assert.throws(() => buildTrashKey(sub, `users/${sub}/pasta/`, at))
assert.equal(parseTrashKey('outro', trashed), null)
assert.equal(parseTrashKey(sub, `trash/${sub}/${at}/`), null)
assert.equal(parseTrashKey(sub, `trash/${sub}/${at}/../../users/${sub}/x`), null)
assert.equal(parseTrashKey(sub, `trash/${sub}/abc/x.txt`), null)
assert.equal(parseTrashKey(sub, `users/${sub}/x.txt`), null)

// retenção
const day = 24 * 60 * 60 * 1000
assert.equal(trashExpiresAt(at, 30), at + 30 * day)
assert.equal(isTrashExpired(at, at + 29 * day, 30), false)
assert.equal(isTrashExpired(at, at + 30 * day, 30), true)

// backups e nomes
assert.ok(isBackupPath('Backups/PC/Daily/2026-11-27/x.txt'))
assert.ok(isBackupPath(`users/${sub}/Backups/PC/x.txt`) )
assert.ok(!isBackupPath('MeusBackups/x.txt'))
assert.ok(!isBackupPath('Fotos/Backups-antigos/x.txt'))
assert.equal(restoredName('relatorio.pdf', new Date('2026-11-27T10:00:00Z')), 'relatorio (restaurado 2026-11-27).pdf')
assert.equal(restoredName('semextensao', new Date('2026-11-27T10:00:00Z')), 'semextensao (restaurado 2026-11-27)')
console.log('LIXEIRA: TODOS OS TESTES PASSARAM')
