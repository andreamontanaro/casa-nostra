import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { categoryTotals, selectionContribution } = await loadTs('../lib/spending.ts')

test('la torta rappresenta 900 euro di spese, il saldo compensa 400 e meno 60', () => {
  const expenses = [
    { category: 'affitto', amount: 800, my_contribution: 400 },
    { category: 'bolletta', amount: 100, my_contribution: -60 },
  ]
  assert.equal(categoryTotals(expenses).reduce((s, c) => s + c.total, 0), 900)
  assert.equal(selectionContribution(expenses), 340)
  assert.equal(selectionContribution(expenses.slice(1)), -60)
})
test('le compensazioni non cancellano le categorie e la selezione vuota vale zero', () => {
  const expenses = [{ category: 'altro', amount: 10, my_contribution: 5 }, { category: 'altro', amount: 10, my_contribution: -5 }]
  assert.deepEqual(categoryTotals(expenses), [{ category: 'altro', total: 20, contribution: 0, count: 2 }])
  assert.equal(selectionContribution(expenses), 0)
  assert.equal(selectionContribution([]), 0)
  assert.deepEqual(categoryTotals([]), [])
})
test('gli aggregati mantengono i centesimi anche con molti importi decimali', () => {
  const expenses = Array.from({ length: 101 }, () => ({ category: 'spesa', amount: .1, my_contribution: -.03 }))
  assert.equal(categoryTotals(expenses)[0].total, 10.1)
  assert.equal(selectionContribution(expenses), -3.03)
})
