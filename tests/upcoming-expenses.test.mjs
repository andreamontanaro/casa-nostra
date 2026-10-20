import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { isUpcoming, splitUpcoming } = await loadTs('../lib/upcoming-expenses.ts')

const expense = (id, expense_date, created_at = '2026-10-20T08:00:00Z') => ({ id, expense_date, created_at })

test('futura è solo una spesa datata dopo oggi: oggi resta fra le passate', () => {
  assert.equal(isUpcoming('2026-10-21', '2026-10-20'), true)
  assert.equal(isUpcoming('2026-10-20', '2026-10-20'), false)
  assert.equal(isUpcoming('2026-10-19', '2026-10-20'), false)
  assert.equal(isUpcoming('2027-01-01', '2026-12-31'), true)
})

test('le future vanno dalla più vicina, le passate restano nell’ordine ricevuto', () => {
  const expenses = [
    expense('luce', '2026-10-30'),
    expense('gas', '2026-11-05'),
    expense('affitto', '2026-10-25'),
    expense('oggi', '2026-10-20'),
    expense('ieri', '2026-10-19'),
  ]
  const { upcoming, past } = splitUpcoming(expenses, '2026-10-20')
  assert.deepEqual(upcoming.map((e) => e.id), ['affitto', 'luce', 'gas'])
  assert.deepEqual(past.map((e) => e.id), ['oggi', 'ieri'])
})

test('nello stesso giorno futuro viene prima quella inserita prima, e l’elenco di partenza non cambia', () => {
  const expenses = [
    expense('dopo', '2026-10-30', '2026-10-20T10:00:00Z'),
    expense('prima', '2026-10-30', '2026-10-18T10:00:00Z'),
  ]
  const { upcoming, past } = splitUpcoming(expenses, '2026-10-20')
  assert.deepEqual(upcoming.map((e) => e.id), ['prima', 'dopo'])
  assert.deepEqual(past, [])
  assert.deepEqual(expenses.map((e) => e.id), ['dopo', 'prima'])
})
