import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { parseEuroInput, previewExpenseShares } = await loadTs('../lib/expense-input.ts')

test('accetta valuta italiana e punto decimale, senza troncare input malformati', () => {
  for (const [raw, expected] of [['1.234,56 €', 1234.56], ['€ 12,50', 12.5], ['12.50', 12.5], ['12,', 12], ['0,01', .01]]) assert.equal(parseEuroInput(raw), expected)
  for (const raw of ['12abc', '1e3', '12,345', '1.234', '-5', '0', '', 'Infinity', '100000000']) assert.equal(parseEuroInput(raw), null, raw)
})
test('le quote 60/40 seguono il reddito e la quota personalizzata segue il pagante', () => {
  const profiles = [{ id: 'a', higher_income: true, display_name: 'A' }, { id: 'b', higher_income: false, display_name: 'B' }]
  assert.deepEqual(previewExpenseShares(100, 'sixty_forty', 'b', null, profiles).map((p) => p.share), [60, 40])
  assert.deepEqual(previewExpenseShares(100, 'custom', 'b', 25, profiles).map((p) => p.share), [25, 75])
})
