import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const { categoryTotals, selectionContribution, ringSegments, RING_OTHER } = await loadTs('../lib/spending.ts')

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

const cat = (category, total) => ({ category, total, contribution: total / 2, count: 1 })

test('con poche categorie l’anello le disegna tutte, senza fetta di coda', () => {
  const six = ['affitto', 'spesa_alimentare', 'casa_arredo', 'viaggi', 'bolletta', 'ristorazione'].map((c, i) => cat(c, 100 - i))
  assert.deepEqual(ringSegments(six), six)
  assert.deepEqual(ringSegments([]), [])
})

test('oltre il massimo la coda confluisce in una sola fetta senza perdere euro', () => {
  const nine = ['affitto', 'spesa_alimentare', 'casa_arredo', 'viaggi', 'bolletta', 'ristorazione', 'trasporti', 'altro', 'abbonamento']
    .map((c, i) => cat(c, 90 - i * 10))
  const segments = ringSegments(nine)
  assert.equal(segments.length, 6)
  // Le prime cinque restano intatte, la sesta è la coda aggregata.
  assert.deepEqual(segments.slice(0, 5), nine.slice(0, 5))
  assert.equal(segments[5].category, RING_OTHER)
  assert.equal(segments[5].count, 4)
  // Il totale disegnato deve coincidere con il totale reale: l'anello non mente.
  const sum = (list) => list.reduce((acc, item) => acc + item.total, 0)
  assert.equal(sum(segments), sum(nine))
  assert.equal(sum(segments.map((s) => ({ total: s.contribution }))), sum(nine.map((n) => ({ total: n.contribution }))))
})

test('la coda somma in centesimi, senza deriva sui decimali', () => {
  const many = Array.from({ length: 12 }, (_, i) => cat(`c${i}`, .1))
  const segments = ringSegments(many)
  assert.equal(segments[5].total, .7)
  assert.equal(segments[5].count, 7)
})
