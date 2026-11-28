// Testes do agendamento noturno e da retenção do app de backup: node scripts/check-backup.cjs
const assert = require('node:assert/strict')
const {
  nextNightlyRun, normalizeBackupTime, normalizeRetentionDays, parseBackupTime,
  shouldRunNightlyBackup, snapshotsToDelete, daysBetween,
} = require('../desktop/schedule.cjs')

const at = (iso) => new Date(iso) // horário local do ambiente de teste
const t = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

// horário
assert.deepEqual(parseBackupTime('03:30'), { hour: 3, minute: 30 })
assert.deepEqual(parseBackupTime('25:99'), { hour: 2, minute: 0 })
assert.deepEqual(parseBackupTime(''), { hour: 2, minute: 0 })
assert.equal(normalizeBackupTime('4:00'), '02:00')
assert.equal(normalizeBackupTime('04:05'), '04:05')

// 02:00, nunca rodou: antes do horário não roda; depois roda
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 1, 59), backupTime: '02:00' }), false)
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 2, 0), backupTime: '02:00' }), true)
// já rodou hoje: não repete
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 23, 0), lastDailyBackup: '2026-11-27', backupTime: '02:00' }), false)
// rodou ontem; às 22h de hoje já passou das 02:00 -> roda (PC estava desligado de madrugada)
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 22, 0), lastDailyBackup: '2026-11-26', backupTime: '02:00' }), true)
// rodou ontem; hoje 01:00 -> espera as 02:00
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 1, 0), lastDailyBackup: '2026-11-26', backupTime: '02:00' }), false)
// ficou 3 dias sem rodar; hoje 01:00 -> recupera já
assert.equal(shouldRunNightlyBackup({ now: t(2026, 11, 27, 1, 0), lastDailyBackup: '2026-11-24', backupTime: '02:00' }), true)
// virada de mês e ano
assert.equal(daysBetween('2026-12-31', '2027-01-02'), 2)
assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1)

// próxima execução
const next = nextNightlyRun({ now: t(2026, 11, 27, 10, 0), lastDailyBackup: '2026-11-27', backupTime: '02:00' })
assert.equal(next.getDate(), 28); assert.equal(next.getHours(), 2)
const soon = nextNightlyRun({ now: t(2026, 11, 27, 1, 0), lastDailyBackup: '2026-11-26', backupTime: '02:00' })
assert.equal(soon.getDate(), 27); assert.equal(soon.getHours(), 2)

// retenção
assert.equal(normalizeRetentionDays(30), 30)
assert.equal(normalizeRetentionDays(1), 7)
assert.equal(normalizeRetentionDays(9999), 365)
assert.equal(normalizeRetentionDays('abc'), 30)
const names = ['2026-10-20', '2026-10-27', '2026-10-28', '2026-10-29', '2026-11-27', 'lixo', '2026-1-1', '../x']
// 30 dias de retenção: 28/10 tem exatamente 30 dias e fica; 27/10 tem 31 e sai
assert.deepEqual(snapshotsToDelete(names, '2026-11-27', 30), ['2026-10-20', '2026-10-27'])
assert.deepEqual(snapshotsToDelete(names, '2026-11-27', 365), [])
assert.deepEqual(snapshotsToDelete(['2026-11-20'], '2026-11-27', 1), []) // mínimo de 7 dias
console.log('BACKUP: TODOS OS TESTES PASSARAM')
