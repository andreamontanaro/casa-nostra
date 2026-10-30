import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { daysAgo, groupRecent } = await loadTs('../lib/recent-groups.ts')

const expense = (id, expense_date) => ({ id, expense_date })

test('i giorni si contano sul calendario, anche a cavallo di mese e anno', () => {
  assert.equal(daysAgo('2026-10-30', '2026-10-30'), 0)
  assert.equal(daysAgo('2026-10-29', '2026-10-30'), 1)
  assert.equal(daysAgo('2026-09-30', '2026-10-01'), 1)
  assert.equal(daysAgo('2025-12-31', '2026-01-01'), 1)
  // Il cambio dell'ora di fine ottobre non sposta il conto.
  assert.equal(daysAgo('2026-10-24', '2026-10-31'), 7)
})

test('ogni spesa va nel suo gruppo, con i confini giusti', () => {
  const today = '2026-10-30'
  const expenses = [
    expense('oggi', '2026-10-30'),
    expense('altro ieri', '2026-10-28'),
    expense('tre giorni fa', '2026-10-27'),
    expense('sei giorni fa', '2026-10-24'),
    expense('sette giorni fa', '2026-10-23'),
    expense('tredici giorni fa', '2026-10-17'),
    expense('quattordici giorni fa', '2026-10-16'),
  ]
  assert.deepEqual(groupRecent(expenses, today).map((g) => [g.label, g.expenses.map((e) => e.id)]), [
    ['Ultimi tre giorni', ['oggi', 'altro ieri']],
    ['Ultima settimana', ['tre giorni fa', 'sei giorni fa']],
    ['Settimana scorsa', ['sette giorni fa', 'tredici giorni fa']],
    ['Più vecchie', ['quattordici giorni fa']],
  ])
})

test('i gruppi vuoti non compaiono e l’ordine delle spese resta quello ricevuto', () => {
  const groups = groupRecent([expense('b', '2026-10-01'), expense('a', '2026-10-05'), expense('c', '2026-10-29')], '2026-10-30')
  assert.deepEqual(groups.map((g) => g.key), ['tre-giorni', 'vecchie'])
  assert.deepEqual(groups[1].expenses.map((e) => e.id), ['b', 'a'])
  assert.deepEqual(groupRecent([], '2026-10-30'), [])
})
