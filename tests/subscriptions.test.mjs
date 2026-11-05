import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'

const {
  INTERVAL_OPTIONS,
  addDays,
  cadenceFromDate,
  cadenceLabel,
  daysBetween,
  dueDatesThrough,
  isIsoDate,
  monthlyAmount,
  nextDueOn,
  occurrence,
  reminderDueOn,
  romeClock,
} = await loadTs('../lib/subscriptions/schedule.ts')

// Internet di casa: ogni 8 del mese, dal novembre 2026.
const internet = { chargeDay: 8, intervalMonths: 1, startMonth: '2026-11-01' }

test('un addebito mensile cade sempre lo stesso giorno', () => {
  assert.equal(occurrence(internet, 0), '2026-11-08')
  assert.equal(occurrence(internet, 1), '2026-12-08')
  assert.equal(occurrence(internet, 2), '2027-01-08')
})

test('il 31 nei mesi corti diventa l’ultimo giorno, poi torna al 31', () => {
  const fine = { chargeDay: 31, intervalMonths: 1, startMonth: '2027-01-01' }
  assert.equal(occurrence(fine, 0), '2027-01-31')
  assert.equal(occurrence(fine, 1), '2027-02-28')
  assert.equal(occurrence(fine, 2), '2027-03-31')
  assert.equal(occurrence(fine, 3), '2027-04-30')
  // 2028 è bisestile.
  assert.equal(occurrence({ ...fine, startMonth: '2028-02-01' }, 0), '2028-02-29')
})

test('cadenze di più mesi saltano i mesi intermedi', () => {
  const bimestrale = { chargeDay: 15, intervalMonths: 2, startMonth: '2026-12-01' }
  assert.equal(occurrence(bimestrale, 1), '2027-02-15')
  const annuale = { chargeDay: 1, intervalMonths: 12, startMonth: '2027-03-01' }
  assert.equal(occurrence(annuale, 1), '2028-03-01')
})

test('il prossimo addebito è oggi se cade oggi, altrimenti il successivo', () => {
  assert.equal(nextDueOn(internet, '2026-11-08'), '2026-11-08')
  assert.equal(nextDueOn(internet, '2026-11-09'), '2026-12-08')
  // Prima del primo addebito non si torna indietro.
  assert.equal(nextDueOn(internet, '2026-01-01'), '2026-11-08')
  assert.equal(nextDueOn({ chargeDay: 10, intervalMonths: 3, startMonth: '2026-01-01' }, '2026-11-05'), '2027-01-10')
})

test('la cadenza nasce dalla data del prossimo addebito', () => {
  assert.deepEqual(cadenceFromDate('2026-12-08', 1), { chargeDay: 8, intervalMonths: 1, startMonth: '2026-12-01' })
})

test('gli addebiti da registrare sono quelli fino a oggi, dal primo in poi', () => {
  assert.deepEqual(dueDatesThrough(internet, '2026-11-07'), [])
  assert.deepEqual(dueDatesThrough(internet, '2026-11-08'), ['2026-11-08'])
  // Cron fermo un mese: si recupera anche quello saltato.
  assert.deepEqual(dueDatesThrough(internet, '2026-12-10'), ['2026-11-08', '2026-12-08'])
})

test('il recupero non va oltre 40 giorni indietro', () => {
  assert.deepEqual(dueDatesThrough(internet, '2027-03-08'), ['2027-02-08', '2027-03-08'])
})

test('il promemoria parte 3 giorni prima, e recupera se quel giorno è saltato', () => {
  assert.equal(reminderDueOn(internet, '2026-11-04'), null)
  assert.equal(reminderDueOn(internet, '2026-11-05'), '2026-11-08')
  assert.equal(reminderDueOn(internet, '2026-11-07'), '2026-11-08')
  // Il giorno dell'addebito non c'è promemoria: c'è la spesa.
  assert.equal(reminderDueOn(internet, '2026-11-08'), null)
  // Cambio d'anno.
  assert.equal(reminderDueOn({ chargeDay: 2, intervalMonths: 1, startMonth: '2027-01-01' }, '2026-12-30'), '2027-01-02')
})

test('date: somma, differenza e validità', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02')
  assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  assert.equal(daysBetween('2026-11-05', '2026-11-08'), 3)
  // Il cambio d'ora non sposta il conto dei giorni.
  assert.equal(daysBetween('2027-03-27', '2027-03-29'), 2)
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('2026-11-08'), true)
  assert.equal(isIsoDate('8/11/2026'), false)
})

test('ora e data della casa, anche a cavallo della mezzanotte e dell’ora legale', () => {
  // 23:30 UTC del 7 novembre = 00:30 dell'8 a Roma (ora solare, +1).
  assert.deepEqual(romeClock(new Date('2026-11-07T23:30:00Z')), { date: '2026-11-08', hour: 0 })
  // Luglio, ora legale (+2): le 7:00 UTC sono le 9 a Roma.
  assert.deepEqual(romeClock(new Date('2027-07-08T07:00:00Z')), { date: '2027-07-08', hour: 9 })
})

test('etichette della cadenza', () => {
  assert.equal(cadenceLabel(internet), 'Ogni mese, il giorno 8')
  assert.equal(cadenceLabel({ chargeDay: 31, intervalMonths: 3, startMonth: '2027-01-01' }), 'Ogni 3 mesi, il giorno 31')
  assert.equal(cadenceLabel({ chargeDay: 8, intervalMonths: 12, startMonth: '2026-12-01' }), 'Ogni anno, l’8 dicembre')
  assert.equal(cadenceLabel({ chargeDay: 1, intervalMonths: 12, startMonth: '2027-03-01' }), 'Ogni anno, il 1º marzo')
})

test('peso mensile', () => {
  assert.equal(monthlyAmount(120, 6), 20)
  assert.equal(monthlyAmount(45, 1), 45)
})

test('le cadenze del codice sono quelle ammesse dal database', async () => {
  const sql = await readFile(new URL('../docs/casa_nostra_schema.sql', import.meta.url), 'utf8')
  const match = /interval_months\s+smallint[^\n]*CHECK \(interval_months IN \(([^)]*)\)\)/.exec(sql)
  assert.ok(match, 'vincolo interval_months non trovato nello schema')
  assert.deepEqual(match[1].split(',').map((n) => Number(n.trim())), [...INTERVAL_OPTIONS])
})
