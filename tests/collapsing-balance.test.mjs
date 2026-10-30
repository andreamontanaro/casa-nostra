import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { collapseProgress, flight, pathData, smoothstep, stripOpacity, unroll } = await loadTs('../lib/collapsing-balance.ts')

// La cifra nella card a 300 px dalla cima, la barra a 80 px.
const hero = (scrollY) => ({ left: 120, top: 300 - scrollY, width: 100, height: 40 })
const target = { left: 280, top: 80, width: 60, height: 24 }

test('la compressione parte a pagina ferma e finisce quando la cifra raggiunge la barra', () => {
  assert.equal(collapseProgress(hero(0), target, 0), 0)
  // Centri: 320 nella pagina, 92 la barra → finisce dopo 228 px.
  assert.equal(collapseProgress(hero(114), target, 114), 0.5)
  assert.equal(collapseProgress(hero(228), target, 228), 1)
  assert.equal(collapseProgress(hero(600), target, 600), 1)
})

test('se la cifra parte già all’altezza della barra basta scorrere un poco', () => {
  const high = { left: 0, top: 70, width: 100, height: 40 }
  assert.equal(collapseProgress(high, target, 0), 0)
  assert.equal(collapseProgress({ ...high, top: 60 }, target, 10), 1)
})

test('il volo parte esattamente sulla cifra della card e atterra sulla barra', () => {
  const clone = { width: 100, height: 40 }
  assert.deepEqual(flight(hero(0), target, clone, 0), { x: 120, y: 300, scale: 1 })
  const end = flight(hero(228), target, clone, 1)
  assert.equal(end.scale, 0.6)
  // A scala 0,6 la copia è 60 × 24, centrata sul centro della barra.
  assert.equal(end.x, 280)
  assert.equal(end.y, 80)
})

test('il volo è continuo e la scala scende senza rimbalzi', () => {
  const clone = { width: 100, height: 40 }
  let last = 1
  for (let s = 0; s <= 228; s += 12) {
    const { scale } = flight(hero(s), target, clone, collapseProgress(hero(s), target, s))
    assert.ok(scale <= last + 1e-9)
    last = scale
  }
})

test('la barra compare solo nell’ultimo tratto', () => {
  assert.equal(stripOpacity(0), 0)
  assert.equal(stripOpacity(0.6), 0)
  assert.equal(stripOpacity(1), 1)
  assert.equal(smoothstep(0.5), 0.5)
  assert.equal(smoothstep(2), 1)
})

// L'anello è un quadrato di 200 px: raggio 89, tratto 11, come il viewBox.
const ring = { left: 0, top: 100, width: 200, height: 200 }
const bar = { left: 100, top: 40, width: 240, height: 8 }
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`)
const polyline = (points) => points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0)

test('all’inizio il tracciato è l’anello, dalla cima in senso orario', () => {
  const { points, strokeWidth } = unroll(ring, bar, 0, 128)
  close(strokeWidth, 11)
  for (const [x, y] of points) close(Math.hypot(x - 100, y - 200), 89)
  // Primo punto in cima, un quarto di giro dopo a destra (orario), chiuso.
  close(points[0][0], 100); close(points[0][1], 111)
  close(points[32][0], 189); close(points[32][1], 200)
  close(points[128][0], 100); close(points[128][1], 111)
})

test('alla fine il tracciato è la barra, da destra a sinistra', () => {
  const { points, strokeWidth } = unroll(ring, bar, 1, 128)
  close(strokeWidth, 8)
  close(points[0][0], 340); close(points[128][0], 100)
  for (const [, y] of points) close(y, 44)
})

test('srotolandosi il tracciato cambia lunghezza senza scatti', () => {
  let last = polyline(unroll(ring, bar, 0).points)
  close(last, 2 * Math.PI * 89, 0.1)
  for (let p = 0.05; p <= 1.0001; p += 0.05) {
    const { points } = unroll(ring, bar, p)
    const length = polyline(points)
    // Dal giro dell'anello (~559 px) ai 240 della barra, sempre calando.
    assert.ok(length <= last + 0.1, `${length} > ${last} a p=${p}`)
    last = length
  }
  close(last, 240, 0.1)
})

test('il tracciato diventa un attributo d', () => {
  assert.equal(pathData([[0, 0], [1.234, 5]]), 'M0.00 0.00L1.23 5.00')
})
