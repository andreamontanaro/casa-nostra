import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { getPeriodRange, getPreviousPeriodRange, inRange, sumAmounts, historyRangeQuery } = await loadTs('../app/(app)/statistiche/period.ts')
const day = (d) => d?.toISOString().slice(0,10)
test('confronta periodi fino allo stesso giorno, senza usare mesi precedenti interi', () => {
  const now = new Date('2026-09-08T12:00:00Z')
  const prev = getPreviousPeriodRange('3months', now)
  assert.equal(day(prev.start), '2026-04-01')
  assert.equal(day(prev.end), '2026-06-09')
  assert.equal(historyRangeQuery(getPeriodRange('month', now)).toString(), 'da=2026-09-01&a=2026-09-08')
})
test('gestisce fine mese, anno bisestile e giorni di Roma', () => {
  assert.equal(day(getPreviousPeriodRange('month', new Date('2026-03-31T12:00:00Z')).end), '2026-03-01')
  assert.equal(day(getPreviousPeriodRange('year', new Date('2024-02-29T12:00:00Z')).end), '2023-03-01')
  const range = getPeriodRange('month', new Date('2026-08-31T22:30:00Z'))
  assert.equal(day(range.start), '2026-09-01')
  assert.equal(inRange('2026-08-31T22:05:00Z', range), true)
  assert.equal(inRange('2026-08-31', range), false)
  assert.equal(inRange('2026-09-02', range), false)
  assert.equal(inRange('invalid', range), false)
})
test('somme monetarie senza residui binari', () => {
  assert.equal(sumAmounts([{amount:.1},{amount:.2}]), .3)
})
