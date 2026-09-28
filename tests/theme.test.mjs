import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'
const { ACCENTS, DEFAULT_ACCENT, isAccent } = await loadTs('../lib/theme.ts')

const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8')

/** Le dichiarazioni `--nome: valore;` del primo blocco che apre con `selector {`. */
function block(selector) {
  const start = css.indexOf(selector + ' {')
  if (start < 0) return null
  const body = css.slice(start + selector.length + 2, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

function palette(id) {
  return id === DEFAULT_ACCENT ? block(':root') : block(`:root:where([data-accent="${id}"])`)
}

const VARS = ['accent', 'accent-foreground', 'accent-muted', 'accent-soft', 'shadow-fab']

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('la menta è l’accento di base e gli id sono tutti diversi', () => {
  assert.equal(ACCENTS[0].id, DEFAULT_ACCENT)
  assert.equal(new Set(ACCENTS.map((a) => a.id)).size, ACCENTS.length)
  assert.equal(ACCENTS.length, 5)
  assert.ok(isAccent('oceano'))
  assert.ok(!isAccent('arcobaleno'))
  assert.ok(!isAccent(null))
})

test('ogni accento ha la palette completa, chiara e scura, in globals.css', () => {
  for (const { id } of ACCENTS) {
    const vars = palette(id)
    assert.ok(vars, `manca il blocco CSS di ${id}`)
    for (const name of VARS) {
      assert.ok(vars['--' + name], `${id}: manca --${name}`)
      assert.ok(vars['--dk-' + name], `${id}: manca --dk-${name}`)
    }
  }
})

test('i campioni del selettore sono i colori veri dell’accento', () => {
  for (const { id, light, dark } of ACCENTS) {
    const vars = palette(id)
    assert.equal(vars['--accent'], light, `${id} chiaro`)
    assert.equal(vars['--dk-accent'], dark, `${id} scuro`)
  }
})

test('ogni accento regge il contrasto AA su crema e su fondo scuro', () => {
  const base = block(':root')
  for (const { id } of ACCENTS) {
    const v = palette(id)
    assert.ok(contrast(v['--accent'], base['--background']) >= 4.5, `${id}: primario su crema`)
    assert.ok(contrast(v['--accent'], base['--surface-raised']) >= 4.5, `${id}: primario su superficie`)
    assert.ok(contrast(v['--accent-foreground'], v['--accent']) >= 4.5, `${id}: testo sul primario`)
    assert.ok(contrast(v['--accent-soft'], v['--accent-muted']) >= 4.5, `${id}: testo sul contenitore`)
    assert.ok(contrast(v['--dk-accent'], base['--dk-background']) >= 4.5, `${id}: primario sul fondo scuro`)
    assert.ok(contrast(v['--dk-accent'], base['--dk-surface-raised']) >= 4.5, `${id}: primario su superficie scura`)
    assert.ok(contrast(v['--dk-accent-foreground'], v['--dk-accent']) >= 4.5, `${id}: testo sul primario scuro`)
    assert.ok(contrast(v['--dk-accent-soft'], v['--dk-accent-muted']) >= 4.5, `${id}: testo sul contenitore scuro`)
  }
})
