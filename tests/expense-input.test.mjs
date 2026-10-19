import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'
const { parseEuroInput, previewExpenseShares } = await loadTs('../lib/expense-input.ts')
const { Constants } = await loadTs('../types/database.ts')

test('accetta valuta italiana e punto decimale, senza troncare input malformati', () => {
  for (const [raw, expected] of [['1.234,56 €', 1234.56], ['€ 12,50', 12.5], ['12.50', 12.5], ['12,', 12], ['0,01', .01]]) assert.equal(parseEuroInput(raw), expected)
  for (const raw of ['12abc', '1e3', '12,345', '1.234', '-5', '0', '', 'Infinity', '100000000']) assert.equal(parseEuroInput(raw), null, raw)
})
test('le quote 60/40 seguono il reddito e la quota personalizzata segue il pagante', () => {
  const profiles = [{ id: 'a', higher_income: true, display_name: 'A' }, { id: 'b', higher_income: false, display_name: 'B' }]
  assert.deepEqual(previewExpenseShares(100, 'sixty_forty', 'b', null, profiles).map((p) => p.share), [60, 40])
  assert.deepEqual(previewExpenseShares(100, 'custom', 'b', 25, profiles).map((p) => p.share), [25, 75])
})
test('«tutta a carico» va per intero a chi non ha pagato, chiunque abbia il reddito maggiore', () => {
  const profiles = [{ id: 'a', higher_income: true, display_name: 'A' }, { id: 'b', higher_income: false, display_name: 'B' }]
  assert.deepEqual(previewExpenseShares(42.5, 'full_other', 'a', null, profiles).map((p) => p.share), [0, 42.5])
  assert.deepEqual(previewExpenseShares(42.5, 'full_other', 'b', null, profiles).map((p) => p.share), [42.5, 0])
})
test('ogni regola di divisione dei tipi esiste nello schema e ha una quota per chi paga e per l\'altro', async () => {
  const sql = await readFile(new URL('../docs/casa_nostra_schema.sql', import.meta.url), 'utf8')
  const enumBody = sql.match(/CREATE TYPE split_rule AS ENUM \(([\s\S]*?)\);/)[1]
  const view = sql.match(/CREATE OR REPLACE VIEW public\.v_expense_shares AS([\s\S]*?);/)[1]
  assert.deepEqual([...enumBody.matchAll(/'(\w+)'/g)].map((m) => m[1]), Constants.public.Enums.split_rule)
  for (const rule of Constants.public.Enums.split_rule) assert.ok(view.includes(`e.split_rule = '${rule}'`), rule)
})
