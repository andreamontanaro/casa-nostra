import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { loadTs } from './load-ts.mjs'

const {
  BOTTOM_R,
  createVessel,
  createWaves,
  forceWaves,
  framing,
  INNER_R,
  innerRadius,
  kickWaves,
  levelVolume,
  NOTCH_H,
  packWaves,
  sampleWaves,
  segmentArea,
  settleWaves,
  slopeFromUp,
  solveLevel,
  stepWaves,
  toHalf,
  volumeBelow,
  WAVE_REST,
  waveSpeed,
} = await loadTs('../lib/chores/liquid3d.ts')
const { getBottleView, getServerBottleView, setBottleView } = await loadTs('../lib/chores/bottle-view.ts')

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b}`)

test('il segmento di cerchio va da tutto a niente', () => {
  close(segmentArea(1, -1), Math.PI, 1e-12)
  close(segmentArea(1, 0), Math.PI / 2, 1e-12)
  assert.equal(segmentArea(1, 1), 0)
  close(segmentArea(2, 0.5) + segmentArea(2, -0.5), Math.PI * 4, 1e-9, 'due metà opposte fanno il cerchio')
})

test('la bottiglia ha fondo arrotondato, corpo dritto e collo stretto', () => {
  const H = 6 * NOTCH_H
  assert.ok(innerRadius(0.001, H) < INNER_R - BOTTOM_R + 0.05)
  assert.equal(innerRadius(BOTTOM_R, H), INNER_R)
  assert.equal(innerRadius(H, H), INNER_R)
  assert.ok(innerRadius(H + 0.3, H) < INNER_R / 2)
  assert.equal(innerRadius(-0.1, H), 0)
})

test('a bottiglia dritta il livello è tacche piene × altezza della tacca', () => {
  const vessel = createVessel(6)
  for (let n = 0; n <= 6; n++) {
    const level = n * NOTCH_H
    const c = solveLevel(vessel, levelVolume(vessel, level), 0, 0)
    if (n === 0) assert.equal(c, -10, 'vuota: nessuna superficie')
    else close(c, level, 1e-6, `${n} tacche`)
  }
  // Una tacca nel corpo dritto vale sempre lo stesso volume.
  const one = levelVolume(vessel, 2 * NOTCH_H) - levelVolume(vessel, NOTCH_H)
  close(levelVolume(vessel, 4 * NOTCH_H) - levelVolume(vessel, 3 * NOTCH_H), one, 1e-9)
})

test('il piano inclinato contiene sempre lo stesso volume', () => {
  const vessel = createVessel(5)
  for (const notches of [0.3, 1, 2.5, 5]) {
    const volume = levelVolume(vessel, notches * NOTCH_H)
    for (const [sx, sz] of [[0, 0], [0.3, 0], [-0.4, 0.5], [1.2, -0.3]]) {
      const c = solveLevel(vessel, volume, sx, sz)
      close(volumeBelow(vessel, c, sx, sz), volume, volume * 1e-4, `${notches} tacche, pendenza ${sx},${sz}`)
    }
  }
})

test('quasi vuota e inclinata, il liquido si raccoglie da una parte', () => {
  const vessel = createVessel(5)
  const volume = levelVolume(vessel, 0.1)
  const slope = Math.tan(0.6)
  const c = solveLevel(vessel, volume, slope, 0)
  assert.ok(c - slope * INNER_R < 0, 'da una parte il fondo resta scoperto')
  assert.ok(c + slope * INNER_R > 0.3, 'dall’altra il liquido è profondo')
})

test('la superficie è perpendicolare alla gravità, fino a un limite', () => {
  assert.deepEqual(slopeFromUp({ x: 0, y: 1, z: 0 }), { x: -0, z: -0 })
  const a = 0.4
  const s = slopeFromUp({ x: Math.sin(a), y: Math.cos(a), z: 0 })
  close(s.x, -Math.tan(a), 1e-12)
  const steep = slopeFromUp({ x: 1, y: 0, z: 0 })
  assert.ok(Number.isFinite(steep.x) && Math.abs(steep.x) <= 1 / 0.3 + 1e-9, 'di lato non esplode')
})

test('le onde partono da una pendenza cambiata, restano a media nulla e si spengono', () => {
  const w = createWaves()
  forceWaves(w, 0.3, 0)
  assert.ok(w.awake)
  let amplitude = settleWaves(w)
  assert.ok(amplitude > 0.1, 'lo scatto si vede')
  const speed = waveSpeed(1)
  let seconds = 0
  let peak = amplitude
  while (amplitude >= WAVE_REST && seconds < 30) {
    for (let i = 0; i < 4; i++) stepWaves(w, 1 / 240, speed)
    amplitude = settleWaves(w)
    peak = Math.max(peak, amplitude)
    seconds += 1 / 60
  }
  let sum = 0
  for (const k of w.cells) sum += w.h[k]
  close(sum / w.cells.length, 0, 1e-6, 'media nulla: il volume sta tutto nel piano')
  assert.ok(peak <= 0.45 + 1e-6, 'ampiezza limitata')
  assert.ok(seconds < 30, `si ferma (dopo ${seconds.toFixed(1)} s)`)
  assert.ok(seconds > 1, 'ma non subito: è liquido, sciaborda')
})

test('un tocco fa un’onda locale; fuori dal disco si legge la cella più vicina', () => {
  const w = createWaves()
  kickWaves(w, 0.3, 0, -2, 0.12)
  for (let i = 0; i < 8; i++) stepWaves(w, 1 / 240, waveSpeed(1))
  assert.ok(sampleWaves(w, 0.3, 0) < 0, 'dove si tocca, la superficie scende')
  assert.ok(Math.abs(sampleWaves(w, -0.6, 0)) < Math.abs(sampleWaves(w, 0.3, 0)), 'lontano, meno')
  assert.equal(sampleWaves(w, INNER_R * 3, 0), sampleWaves(w, INNER_R * 0.99, 0))
})

test('le onde vanno in una texture a mezza precisione', () => {
  assert.equal(toHalf(0), 0)
  assert.equal(toHalf(1), 0x3c00)
  assert.equal(toHalf(0.5), 0x3800)
  assert.equal(toHalf(-2), 0xc000)
  assert.equal(toHalf(1e-9), 0)
  assert.equal(toHalf(1e9), 0x7bff, 'troppo grande: il massimo finito, non infinito')
  const w = createWaves(12)
  forceWaves(w, 0.2, -0.1)
  const out = new Uint16Array(12 * 12 * 4)
  packWaves(w, out)
  for (const k of w.outside) assert.equal(out[4 * k], out[4 * w.near[k]], 'fuori dal disco: copia del vicino')
})

test('acqua bassa, onde lente', () => {
  assert.equal(waveSpeed(0), 0)
  assert.ok(waveSpeed(0.1) < waveSpeed(0.5))
  assert.ok(waveSpeed(3) - waveSpeed(2) < 0.05, 'in acqua profonda la velocità non cresce più')
})

test('inquadratura: allineate in alto, riquadro quasi quadrato', () => {
  const week = framing(6)
  const weekend = framing(5)
  assert.equal(week.topY, 6 * NOTCH_H)
  assert.ok(week.aspect > 0.8 && week.aspect < 1.1)
  assert.ok(weekend.aspect > week.aspect, 'nel weekend le bottiglie sono più corte, il riquadro più basso')
})

test('la vista di serie è il 2D, anche senza localStorage', () => {
  assert.equal(getServerBottleView(), '2d')
  assert.equal(getBottleView(), '2d')
  setBottleView('3d')
  assert.equal(getBottleView(), '3d', 'la scelta vale almeno finché la pagina resta aperta')
  setBottleView('2d')
  assert.equal(getBottleView(), '2d')
})

/** Tutti i file sorgente dell'app, per controllare chi importa cosa. */
async function sources(dir) {
  const out = []
  for (const entry of await readdir(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...(await sources(path)))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path)
  }
  return out
}

test('three.js si scarica solo con la vista 3D', async () => {
  const files = [...(await sources('app')), ...(await sources('components')), ...(await sources('lib'))]
  for (const file of files) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    if (/from ['"]three['"]|import\(['"]three['"]\)/.test(text)) {
      assert.ok(file.startsWith('lib/chores/bottles3d/'), `${file} importa three.js`)
    }
    if (/from ['"]@\/lib\/chores\/bottles3d\//.test(text)) {
      assert.equal(file, 'components/chores/ChoreBottles3D.tsx', `${file} importa la scena 3D`)
    }
    if (/from ['"]@\/components\/chores\/ChoreBottles3D['"]/.test(text)) {
      assert.fail(`${file} importa ChoreBottles3D in modo statico: va caricato con next/dynamic`)
    }
  }
  const shell = await readFile(new URL('../app/(app)/faccende/FaccendeShell.tsx', import.meta.url), 'utf8')
  assert.match(shell, /import\('@\/components\/chores\/ChoreBottles3D'\)/)
  assert.match(shell, /dynamic\(loadBottles3D, \{ ssr: false/)
})
