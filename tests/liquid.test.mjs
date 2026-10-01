import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'
const {
  createLiquid,
  flatClips,
  LIQUID_SHADE,
  liquidPaths,
  liquidShape,
  meanHeight,
  NOTCH_PX,
  setLiquidTarget,
  solveLine,
  stepLiquid,
  streamSegments,
} = await loadTs('../lib/chores/liquid.ts')
const { ACCENTS, DEFAULT_ACCENT } = await loadTs('../lib/theme.ts')

const W = 170
const STILL = { tilt: 0, jolt: 0 }

/** Un caso ripetibile al posto di Math.random. */
function seeded(seed = 7) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647
}

/** Una bottiglia da 6 tacche. */
function bottle(bonus, main, notches = 6) {
  return createLiquid({ width: W, height: notches * NOTCH_PX, bonus, main, random: seeded() })
}

/** Fa girare la simulazione a 60 fps finché si ferma (o per `seconds`). */
function run(liquid, input = STILL, seconds = 10, onFrame = () => {}) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    const moving = stepLiquid(liquid, 1 / 60, input)
    onFrame(liquid, t)
    if (!moving) return t
  }
  return Infinity
}

test('la retta inclinata contiene sempre lo stesso volume', () => {
  const H = 336
  for (const mean of [0, 5, 56, 168, 300, 336]) {
    for (const slope of [0, 0.2, -0.5, 1.2]) {
      const c = solveLine(mean, slope, W, H)
      assert.ok(Math.abs(meanHeight(c, slope, W, H) - mean) < 1e-6, `media ${mean}, pendenza ${slope}`)
    }
  }
})

test('quasi vuota e inclinata, il liquido si raccoglie in un angolo; piena non si muove', () => {
  const H = 280
  const slope = Math.tan(0.6)
  const c = solveLine(10, slope, W, H)
  assert.equal(Math.max(0, c + slope * (0 - W / 2)), 0, 'a sinistra il fondo resta scoperto')
  assert.ok(c + slope * (W / 2) > 30, 'a destra il liquido è profondo')
  const full = solveLine(H, slope, W, H)
  assert.ok(full - (slope * W) / 2 >= H - 0.01, 'piena: tutta la retta sta sopra il tappo')
})

test('una faccenda nuova la versa un getto: prima cade, poi il livello sale fino alla tacca', () => {
  const liquid = bottle(0, NOTCH_PX)
  setLiquidTarget(liquid, 0, 2 * NOTCH_PX)
  let levelBeforeLanding = null
  let sawStream = false
  const stoppedAt = run(liquid, STILL, 10, (l) => {
    if (l.stream) sawStream = true
    if (l.stream && !l.stream.landed) levelBeforeLanding = l.main
  })
  assert.ok(sawStream)
  assert.equal(levelBeforeLanding, NOTCH_PX, 'finché il getto non tocca, il livello non cambia')
  assert.equal(liquid.main, 2 * NOTCH_PX)
  assert.equal(liquid.stream, null)
  assert.ok(stoppedAt < 8, 'poi torna fermo')
})

test('la prima faccenda di chi lavora da casa riempie lo strato bonus, poi le altre sopra', () => {
  const liquid = bottle(0, 0)
  setLiquidTarget(liquid, NOTCH_PX, NOTCH_PX)
  const order = []
  run(liquid, STILL, 10, (l) => {
    if (l.stream?.landed && !l.stream.ending) {
      const layer = l.stream.bonus ? 'bonus' : 'faccende'
      if (order.at(-1) !== layer) order.push(layer)
    }
  })
  assert.deepEqual(order, ['bonus', 'faccende'])
  assert.equal(liquid.bonus, NOTCH_PX)
  assert.equal(liquid.main, NOTCH_PX)
})

test('togliendo una faccenda il livello scende da solo, senza getto', () => {
  const liquid = bottle(NOTCH_PX, 2 * NOTCH_PX)
  setLiquidTarget(liquid, NOTCH_PX, NOTCH_PX)
  run(liquid, STILL, 10, (l) => assert.equal(l.stream, null))
  assert.equal(liquid.main, NOTCH_PX)
  assert.equal(liquid.bonus, NOTCH_PX)
})

test('inclinando il telefono la superficie si inclina, a volume costante', () => {
  const liquid = bottle(0, 3 * NOTCH_PX)
  const tilt = 0.3
  let overshoot = 0
  const stoppedAt = run(liquid, { tilt, jolt: 0 }, 15, (l) => { overshoot = Math.max(overshoot, l.angle) })
  assert.ok(stoppedAt < 15, 'si assesta')
  assert.ok(overshoot > tilt, 'prima sciaborda oltre')
  assert.equal(liquid.angle, tilt)
  const { xs, surface } = liquidShape(liquid)
  const H = liquid.height
  // Più liquido a destra, con la pendenza dell'inclinazione.
  const slope = ((H - surface.at(-1)) - (H - surface[0])) / (xs.at(-1) - xs[0])
  assert.ok(Math.abs(slope - Math.tan(tilt)) < 1e-6)
  const mean = surface.reduce((sum, y) => sum + H - y, 0) / surface.length
  assert.ok(Math.abs(mean - 3 * NOTCH_PX) < 0.5)
})

test('uno scossone increspa la superficie, che poi torna piatta', () => {
  const liquid = bottle(0, 2 * NOTCH_PX)
  stepLiquid(liquid, 1 / 60, { tilt: 0, jolt: 0.6 })
  run(liquid, STILL, 0.3)
  const { surface } = liquidShape(liquid)
  assert.ok(Math.max(...surface) - Math.min(...surface) > 1, 'si vede l’onda')
  assert.ok(run(liquid) < 10)
  const still = liquidShape(liquid).surface
  assert.equal(Math.max(...still) - Math.min(...still), 0)
})

test('i tracciati sono SVG validi e lo strato bonus c’è solo quando serve', () => {
  const plain = liquidPaths(bottle(0, NOTCH_PX, 5))
  assert.equal(plain.bonus, '')
  assert.equal(plain.layer, '')
  for (const d of Object.values(plain)) assert.doesNotMatch(d, /NaN|e[-+]?\d|Infinity/)

  const liquid = bottle(NOTCH_PX, NOTCH_PX)
  setLiquidTarget(liquid, NOTCH_PX, 3 * NOTCH_PX)
  run(liquid, { tilt: 0.4, jolt: 0 }, 0.4)
  const moving = liquidPaths(liquid)
  for (const d of Object.values(moving)) assert.doesNotMatch(d, /NaN|e[-+]?\d|Infinity/)
  assert.ok(moving.bonus.length > 0 && moving.layer.length > 0)

  assert.equal(liquidPaths(bottle(0, 0)).surface, '', 'bottiglia vuota: nessuna linea sul fondo')
  assert.deepEqual(flatClips(336, 56, 112), {
    air: 'inset(0 0 168px 0)',
    main: 'inset(168px 0 56px 0)',
    bonus: 'inset(280px 0 0 0)',
  })
})

test('il getto attraversa la spalla e poi il corpo', () => {
  const liquid = bottle(0, 0)
  setLiquidTarget(liquid, 0, NOTCH_PX)
  stepLiquid(liquid, 0.05, STILL)
  const early = streamSegments(liquid)
  assert.ok(early.neck.height > 0)
  assert.equal(early.body.height, 0)
  run(liquid, STILL, 0.3)
  const later = streamSegments(liquid)
  assert.ok(later.body.height > 0)
})

/* ─── Contrasto del testo nel liquido ───────────────────────── */

const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

function block(selector) {
  const start = css.indexOf(selector + ' {')
  const body = css.slice(start + selector.length + 2, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** `color-mix(in srgb, a, b p%)`. */
const mix = (a, b, p) => a.map((v, i) => v * (1 - p / 100) + b[i] * (p / 100))
function luminance(color) {
  const [r, g, b] = color.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('i nomi delle faccende scritti nel liquido reggono l’AA con ogni accento, in chiaro e in scuro', () => {
  const white = [255, 255, 255]
  for (const { id } of ACCENTS) {
    const vars = id === DEFAULT_ACCENT ? block(':root') : block(`:root:where([data-accent="${id}"])`)
    for (const prefix of ['--', '--dk-']) {
      const accent = rgb(vars[`${prefix}accent`])
      const text = rgb(vars[`${prefix}accent-foreground`])
      const muted = rgb(vars[`${prefix}accent-muted`])
      const soft = rgb(vars[`${prefix}accent-soft`])
      const deep = mix(accent, soft, LIQUID_SHADE.deep)
      // Le faccende: dalla superficie al fondo, sotto il vetro (bordi e riflesso).
      for (const [where, color] of Object.entries({
        superficie: accent,
        fondo: deep,
        bordo: mix(deep, soft, LIQUID_SHADE.glassEdge),
        riflesso: mix(accent, white, LIQUID_SHADE.glassShine),
        'riflesso sul fondo': mix(deep, white, LIQUID_SHADE.glassShine),
      })) {
        assert.ok(contrast(text, color) >= 4.5, `${id} ${prefix}: faccende, ${where}`)
      }
      // Il bonus: dal contenitore al suo fondo.
      for (const [where, color] of Object.entries({
        superficie: muted,
        fondo: mix(muted, accent, LIQUID_SHADE.bonusDeep),
      })) {
        assert.ok(contrast(soft, color) >= 4.5, `${id} ${prefix}: bonus, ${where}`)
      }
    }
  }
})
