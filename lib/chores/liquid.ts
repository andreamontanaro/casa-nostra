/**
 * Il liquido delle bottiglie delle faccende, in funzioni pure: niente DOM e
 * niente sensori. `useBottleLiquid` lo fa avanzare a ogni fotogramma con
 * l'inclinazione del telefono e lo disegna; qui c'è solo la fisica, così si
 * prova con `node --test`.
 *
 * Il modello, dal più grande al più piccolo:
 * - **il volume**: due strati, il bonus in fondo e le faccende sopra, misurati
 *   come altezza media in px (una tacca piena = `NOTCH_PX`). Quando si segna
 *   una faccenda il volume non salta: lo versa un getto che scende dal collo;
 *   quando se ne toglie una, il livello scende da solo;
 * - **l'inclinazione**: la superficie è una retta perpendicolare alla gravità
 *   che il telefono sente. La retta segue l'inclinazione con una molla poco
 *   smorzata, ed è quella l'onda lunga che va e viene (lo sciabordio). È
 *   calcolata a volume costante dentro il rettangolo della bottiglia: quasi
 *   vuota e inclinata, il liquido si raccoglie in un angolo; piena, non si
 *   muove;
 * - **le increspature**: una fila di colonne con l'equazione delle onde, a
 *   media nulla (il volume sta tutto nella retta), eccitata dal getto, dai
 *   tocchi, dagli scossoni e dai cambi bruschi di inclinazione.
 *
 * Unità: px e secondi. x da sinistra, altezze dal fondo; le funzioni che
 * preparano i tracciati SVG voltano le y (dall'alto), come vuole il DOM.
 */

/** Altezza di una tacca: `h-14`. */
export const NOTCH_PX = 56

/**
 * La spalla disegnata sopra il corpo (`h-16`, viewBox alto 60) e il fondo del
 * tappo, da cui esce il getto: 12 unità del viewBox.
 */
export const SHOULDER_PX = 64
export const SHOULDER_VIEWBOX = 60
export const CAP_BOTTOM = 12
/** Quanto cade il getto prima di entrare nel corpo della bottiglia. */
export const STREAM_DROP_PX = SHOULDER_PX - (CAP_BOTTOM * SHOULDER_PX) / SHOULDER_VIEWBOX
/** Larghezza del getto, in unità del viewBox della spalla (largo 100). */
export const STREAM_WIDTH = 3.2

/** Bolle disegnate al massimo per bottiglia: il componente ne prepara tanti cerchi. */
export const MAX_BUBBLES = 12

/**
 * Le sfumature del liquido, in percentuale di `color-mix(in srgb, …)`: sul
 * fondo l'accento si mescola con `--accent-soft`, il vetro scurisce i bordi e
 * ha un riflesso bianco. `--accent-soft` va sempre nel verso del contrasto col
 * testo (più scuro in chiaro, più chiaro in scuro), il riflesso no: per questo
 * è leggero. `tests/chores.test.mjs` verifica che il nome delle faccende,
 * scritto nel liquido, regga l'AA con ogni accento.
 */
export const LIQUID_SHADE = {
  /** Il fondo dello strato delle faccende: accento + soft. */
  deep: 30,
  /** I bordi del vetro: + soft. */
  glassEdge: 12,
  /** Il riflesso verticale: + bianco. */
  glassShine: 10,
  /** Il fondo dello strato bonus: contenitore + accento. */
  bonusDeep: 12,
} as const

const COLUMNS = 28
const STEP = 1 / 120
/** Oltre ~50° si smette di inclinare: telefono capovolto o di lato. */
const MAX_TILT = 0.9
const SLOSH_OMEGA = 8.5
const SLOSH_ZETA = 0.13
/** Quanto le accelerazioni dell'inclinazione increspano la superficie. */
const SLOSH_RIPPLE = 0.06
const WAVE_SPEED = 240
const WAVE_DAMPING = 2.2
const RIPPLE_LIMIT = 22
/** Sotto questa profondità (o così vicino al tappo) le onde si spengono. */
const RIPPLE_FADE = 12
const DRAIN_TIME = 0.22
const POUR_TIME = 0.9
const POUR_MIN_RATE = 95
const POUR_MAX_RATE = 420
const STREAM_SPEED = 240
const STREAM_GRAVITY = 3200
const SPLASH_LANDING = 70
const SPLASH_FLOW = 1100
const SPLASH_WIDTH = 7
const POKE = 55
const JOLT_GAIN = 220
const BUBBLE_RATE = 16
const EPS = 0.05

export interface LiquidStream {
  /** Testa e coda del getto, in px dal fondo del tappo. */
  head: number
  headSpeed: number
  tail: number
  tailSpeed: number
  /** La testa ha toccato la superficie: da qui il volume entra. */
  landed: boolean
  /** Non c'è più niente da versare: la coda cade e il getto finisce. */
  ending: boolean
  /** Sta versando nello strato bonus (colore diverso). */
  bonus: boolean
}

export interface LiquidBubble {
  x: number
  /** Dall'alto, come nel DOM. */
  y: number
  r: number
  rise: number
  phase: number
  age: number
}

export interface Liquid {
  width: number
  height: number
  /** Altezza media degli strati adesso, in px. */
  bonus: number
  main: number
  targetBonus: number
  targetMain: number
  /** Inclinazione della superficie in radianti: positiva, il liquido sale a destra. */
  angle: number
  spin: number
  wave: Float64Array
  waveVelocity: Float64Array
  stream: LiquidStream | null
  bubbles: LiquidBubble[]
  /** Tempo non ancora simulato: si avanza a passi fissi. */
  pending: number
  random: () => number
}

export interface LiquidInput {
  /** Inclinazione della gravità nello schermo, in radianti (0 = verso il basso). */
  tilt: number
  /** Scossoni arrivati dall'ultimo fotogramma, in g. */
  jolt: number
}

export interface LiquidOptions {
  width: number
  height: number
  bonus: number
  main: number
  random?: () => number
}

/** Un liquido fermo, già al suo livello. */
export function createLiquid({ width, height, bonus, main, random = Math.random }: LiquidOptions): Liquid {
  const liquid: Liquid = {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
    bonus: 0,
    main: 0,
    targetBonus: 0,
    targetMain: 0,
    angle: 0,
    spin: 0,
    wave: new Float64Array(COLUMNS),
    waveVelocity: new Float64Array(COLUMNS),
    stream: null,
    bubbles: [],
    pending: 0,
    random,
  }
  setLiquidTarget(liquid, bonus, main)
  liquid.bonus = liquid.targetBonus
  liquid.main = liquid.targetMain
  return liquid
}

/** Il livello a cui arrivare: lo raggiunge versando (se sale) o scendendo da solo. */
export function setLiquidTarget(liquid: Liquid, bonus: number, main: number) {
  liquid.targetBonus = clamp(bonus, 0, liquid.height)
  liquid.targetMain = clamp(main, 0, liquid.height - liquid.targetBonus)
}

export function resizeLiquid(liquid: Liquid, width: number, height: number) {
  liquid.width = Math.max(width, 1)
  liquid.height = Math.max(height, 1)
  setLiquidTarget(liquid, liquid.targetBonus, liquid.targetMain)
  liquid.bonus = Math.min(liquid.bonus, liquid.height)
  liquid.main = Math.min(liquid.main, liquid.height - liquid.bonus)
}

/** Un tocco sulla bottiglia: un'onda che parte da x. */
export function pokeLiquid(liquid: Liquid, x: number, strength = POKE) {
  impulse(liquid, x, strength)
}

/** Tutto fermo e al suo posto, subito: per chi ha chiesto meno movimento. */
export function settleLiquid(liquid: Liquid) {
  liquid.bonus = liquid.targetBonus
  liquid.main = liquid.targetMain
  liquid.angle = 0
  liquid.spin = 0
  liquid.wave.fill(0)
  liquid.waveVelocity.fill(0)
  liquid.stream = null
  liquid.bubbles = []
  liquid.pending = 0
}

/**
 * Fa avanzare il liquido di `elapsed` secondi. Restituisce `false` quando è
 * tornato fermo (e allora lo blocca esattamente al suo posto): chi lo anima
 * può smettere di chiedere fotogrammi finché non cambia qualcosa.
 */
export function stepLiquid(liquid: Liquid, elapsed: number, input: LiquidInput): boolean {
  // Dopo una pausa (scheda in background) non si recupera il tempo perso.
  liquid.pending += Math.min(Math.max(elapsed, 0), 0.1)
  if (input.jolt > 0) shake(liquid, input.jolt)
  const tilt = clamp(input.tilt, -MAX_TILT, MAX_TILT)
  while (liquid.pending >= STEP) {
    advance(liquid, STEP, tilt)
    liquid.pending -= STEP
  }
  if (!isResting(liquid, tilt)) return true
  liquid.angle = tilt
  liquid.spin = 0
  liquid.wave.fill(0)
  liquid.waveVelocity.fill(0)
  liquid.bonus = liquid.targetBonus
  liquid.main = liquid.targetMain
  return false
}

function advance(liquid: Liquid, dt: number, tilt: number) {
  const { width: W, wave, waveVelocity: velocity } = liquid

  // L'onda lunga: l'inclinazione insegue quella del telefono con una molla.
  const accel = -SLOSH_OMEGA * SLOSH_OMEGA * (liquid.angle - tilt) - 2 * SLOSH_ZETA * SLOSH_OMEGA * liquid.spin
  liquid.spin += accel * dt
  liquid.angle += liquid.spin * dt
  if (Math.abs(liquid.angle) > MAX_TILT) {
    liquid.angle = Math.sign(liquid.angle) * MAX_TILT
    liquid.spin = 0
  }

  // Le increspature: equazione delle onde con bordi riflettenti.
  const dx = W / (COLUMNS - 1)
  const k = (WAVE_SPEED / dx) ** 2
  for (let i = 0; i < COLUMNS; i++) {
    const left = wave[i > 0 ? i - 1 : i]
    const right = wave[i < COLUMNS - 1 ? i + 1 : i]
    const lag = SLOSH_RIPPLE * accel * (i * dx - W / 2)
    velocity[i] += (k * (left + right - 2 * wave[i]) - WAVE_DAMPING * velocity[i] - lag) * dt
  }
  for (let i = 0; i < COLUMNS; i++) {
    wave[i] = clamp(wave[i] + velocity[i] * dt, -RIPPLE_LIMIT, RIPPLE_LIMIT)
  }
  zeroMean(wave)
  zeroMean(velocity)

  // Quello che si toglie scende da solo, senza getto.
  const drain = 1 - Math.exp(-dt / DRAIN_TIME)
  if (liquid.bonus > liquid.targetBonus) liquid.bonus = approach(liquid.bonus, liquid.targetBonus, drain)
  if (liquid.main > liquid.targetMain) liquid.main = approach(liquid.main, liquid.targetMain, drain)

  pour(liquid, dt)
  rise(liquid, dt)
}

/** Il getto: scende dal tappo, tocca la superficie, versa finché serve, poi la coda cade. */
function pour(liquid: Liquid, dt: number) {
  const needBonus = liquid.targetBonus - liquid.bonus
  const needMain = liquid.targetMain - liquid.main
  const pouring = needBonus > EPS || needMain > EPS

  if (pouring && !liquid.stream) {
    liquid.stream = {
      head: 0,
      headSpeed: STREAM_SPEED,
      tail: 0,
      tailSpeed: 0,
      landed: false,
      ending: false,
      bonus: needBonus > EPS,
    }
  }
  const stream = liquid.stream
  if (!stream) return

  const centre = liquid.width / 2
  const fall = STREAM_DROP_PX + liquid.height - surfaceHeightAt(liquid, centre)
  if (!stream.landed) {
    stream.headSpeed += STREAM_GRAVITY * dt
    stream.head += stream.headSpeed * dt
    if (stream.head >= fall) {
      stream.landed = true
      impulse(liquid, centre, SPLASH_LANDING)
    }
  }
  if (stream.landed) stream.head = fall

  if (!pouring) stream.ending = true
  if (stream.landed && !stream.ending) {
    const need = Math.max(needBonus, 0) + Math.max(needMain, 0)
    let inflow = clamp(need / POUR_TIME, POUR_MIN_RATE, POUR_MAX_RATE) * dt
    stream.bonus = needBonus > EPS
    if (needBonus > 0) {
      const into = Math.min(inflow, needBonus)
      liquid.bonus += into
      inflow -= into
    }
    if (inflow > 0 && needMain > 0) liquid.main += Math.min(inflow, needMain)
    const at = centre + (liquid.random() - 0.5) * 3
    impulse(liquid, at, SPLASH_FLOW * dt)
    spawnBubble(liquid, dt)
  }

  if (stream.ending) {
    stream.tailSpeed += STREAM_GRAVITY * dt
    stream.tail += stream.tailSpeed * dt
    if (stream.tail >= stream.head) liquid.stream = null
  }
}

function spawnBubble(liquid: Liquid, dt: number) {
  const { random } = liquid
  const depth = surfaceHeightAt(liquid, liquid.width / 2)
  if (depth < 14 || liquid.bubbles.length >= MAX_BUBBLES || random() > BUBBLE_RATE * dt) return
  const top = liquid.height - depth
  liquid.bubbles.push({
    x: liquid.width / 2 + (random() - 0.5) * 12,
    y: top + 8 + random() * Math.min(28, depth - 12),
    r: 1 + random() * 1.8,
    rise: 30 + random() * 40,
    phase: random() * Math.PI * 2,
    age: 0,
  })
}

/** Le bolle salgono ondeggiando e spariscono alla superficie. */
function rise(liquid: Liquid, dt: number) {
  if (liquid.bubbles.length === 0) return
  liquid.bubbles = liquid.bubbles.filter((bubble) => {
    bubble.age += dt
    bubble.y -= bubble.rise * dt
    bubble.x += Math.sin(bubble.phase + bubble.age * 7) * 8 * dt
    return bubble.y - bubble.r > liquid.height - surfaceHeightAt(liquid, bubble.x)
  })
}

/** Uno scossone: qualche onda di forma diversa, proporzionale alla botta. */
function shake(liquid: Liquid, jolt: number) {
  const { random, waveVelocity: velocity } = liquid
  const strength = JOLT_GAIN * Math.min(jolt, 1)
  const modes = [1, 2, 3].map((k) => ({ k, amp: (random() - 0.5) * 2 / k, phase: random() * Math.PI * 2 }))
  for (let i = 0; i < COLUMNS; i++) {
    const x = i / (COLUMNS - 1)
    let v = 0
    for (const { k, amp, phase } of modes) v += amp * Math.sin(k * Math.PI * x + phase)
    velocity[i] += strength * v
  }
  zeroMean(velocity)
}

function impulse(liquid: Liquid, x: number, strength: number) {
  const dx = liquid.width / (COLUMNS - 1)
  for (let i = 0; i < COLUMNS; i++) {
    const d = (i * dx - x) / SPLASH_WIDTH
    liquid.waveVelocity[i] -= strength * Math.exp(-d * d)
  }
  zeroMean(liquid.waveVelocity)
}

function isResting(liquid: Liquid, tilt: number): boolean {
  if (liquid.stream || liquid.bubbles.length > 0) return false
  if (Math.abs(liquid.targetBonus - liquid.bonus) > EPS || Math.abs(liquid.targetMain - liquid.main) > EPS) return false
  if (Math.abs(liquid.angle - tilt) > 0.0015 || Math.abs(liquid.spin) > 0.002) return false
  for (let i = 0; i < COLUMNS; i++) {
    if (Math.abs(liquid.wave[i]) > 0.06 || Math.abs(liquid.waveVelocity[i]) > 0.6) return false
  }
  return true
}

/* ─── Geometria ─────────────────────────────────────────────── */

/**
 * L'altezza media di una retta `c + slope·(x − W/2)` tagliata tra il fondo
 * (0) e il tappo (H): l'area del liquido divisa per la larghezza.
 */
export function meanHeight(c: number, slope: number, width: number, height: number): number {
  if (Math.abs(slope) < 1e-9) return clamp(c, 0, height)
  const half = (slope * width) / 2
  return (clipped(c + half, height) - clipped(c - half, height)) / (slope * width)
}

/** ∫ clamp(u, 0, H) du da −∞ a u. */
function clipped(u: number, height: number): number {
  if (u <= 0) return 0
  if (u <= height) return (u * u) / 2
  return (height * height) / 2 + height * (u - height)
}

/** Dove sta la retta inclinata che contiene esattamente `mean` px di liquido. */
export function solveLine(mean: number, slope: number, width: number, height: number): number {
  const target = clamp(mean, 0, height)
  const reach = (Math.abs(slope) * width) / 2
  let lo = -reach
  let hi = height + reach
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (meanHeight(mid, slope, width, height) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Le onde si spengono dove il liquido è quasi finito o tocca il tappo. */
function rippleAt(liquid: Liquid, base: number, i: number): number {
  const room = Math.min(base, liquid.height - base)
  return liquid.wave[i] * clamp(room / RIPPLE_FADE, 0, 1)
}

function waveAt(liquid: Liquid, x: number): number {
  const t = clamp(x / liquid.width, 0, 1) * (COLUMNS - 1)
  const i = Math.min(Math.floor(t), COLUMNS - 2)
  return liquid.wave[i] + (liquid.wave[i + 1] - liquid.wave[i]) * (t - i)
}

/** Altezza della superficie in x, dal fondo. */
export function surfaceHeightAt(liquid: Liquid, x: number): number {
  const { width: W, height: H } = liquid
  const slope = Math.tan(liquid.angle)
  const base = clamp(solveLine(liquid.bonus + liquid.main, slope, W, H) + slope * (x - W / 2), 0, H)
  const room = Math.min(base, H - base)
  return clamp(base + waveAt(liquid, x) * clamp(room / RIPPLE_FADE, 0, 1), 0, H)
}

export interface LiquidShape {
  /** Le x delle colonne. */
  xs: number[]
  /** La superficie, in y dall'alto. */
  surface: number[]
  /** Il confine tra bonus e faccende, in y dall'alto; null se non c'è bonus. */
  layer: number[] | null
}

/** La forma di adesso: superficie e confine tra gli strati, colonna per colonna. */
export function liquidShape(liquid: Liquid): LiquidShape {
  const { width: W, height: H } = liquid
  const slope = Math.tan(liquid.angle)
  const c = solveLine(liquid.bonus + liquid.main, slope, W, H)
  const hasLayer = liquid.bonus > EPS || liquid.targetBonus > 0
  const cb = hasLayer ? solveLine(liquid.bonus, slope, W, H) : 0
  const xs: number[] = []
  const surface: number[] = []
  const layer: number[] = []
  for (let i = 0; i < COLUMNS; i++) {
    const x = (i * W) / (COLUMNS - 1)
    const base = clamp(c + slope * (x - W / 2), 0, H)
    const top = clamp(base + rippleAt(liquid, base, i), 0, H)
    xs.push(x)
    surface.push(H - top)
    if (hasLayer) {
      // Il confine tra due liquidi si muove molto meno della superficie.
      const lower = clamp(cb + slope * (x - W / 2), 0, H)
      layer.push(H - Math.min(clamp(lower + rippleAt(liquid, lower, i) * 0.3, 0, H), top))
    }
  }
  return { xs, surface, layer: hasLayer ? layer : null }
}

export interface LiquidPaths {
  /** Tutto il liquido, dalla superficie al fondo. */
  liquid: string
  /** Lo strato delle faccende, tra il confine e la superficie. */
  main: string
  /** Lo strato bonus, dal confine al fondo ('' se non c'è). */
  bonus: string
  /** L'aria sopra la superficie. */
  air: string
  /** La linea della superficie, per il riflesso ('' a bottiglia vuota). */
  surface: string
  /** La linea del confine tra gli strati ('' se non c'è). */
  layer: string
}

/**
 * I tracciati, in px del corpo della bottiglia: servono all'SVG del liquido e,
 * come `clip-path: path()`, ai tre strati di testo (asciutto, nelle faccende,
 * nel bonus). Debordano di 1 px sui lati e sul fondo, così non resta un filo
 * chiaro lungo il vetro.
 */
export function liquidPaths(liquid: Liquid): LiquidPaths {
  const { xs, surface, layer } = liquidShape(liquid)
  const L = -1
  const R = liquid.width + 1
  const B = liquid.height + 1
  const along = forward(xs, surface, L, R)
  const backAlong = backward(xs, surface, L, R)
  const empty = liquid.bonus + liquid.main < 0.5 && !liquid.stream

  const liquidPath = `${along}L${R} ${B}L${L} ${B}Z`
  const air = `M${L} ${L}L${R} ${L}${backAlong}Z`
  if (!layer) {
    return { liquid: liquidPath, main: liquidPath, bonus: '', air, surface: empty ? '' : along, layer: '' }
  }
  const layerAlong = forward(xs, layer, L, R)
  const layerBack = backward(xs, layer, L, R)
  return {
    liquid: liquidPath,
    main: `${along}${layerBack}Z`,
    bonus: `${layerAlong}L${R} ${B}L${L} ${B}Z`,
    air,
    surface: empty ? '' : along,
    layer: liquid.bonus > EPS && liquid.main > EPS ? layerAlong : '',
  }
}

/**
 * Prima che la pagina sappia quanto è larga la bottiglia (HTML del server,
 * prima dell'idratazione) i ritagli dei testi non possono essere tracciati in
 * px: a liquido fermo bastano dei rettangoli.
 */
export function flatClips(height: number, bonus: number, main: number) {
  const level = bonus + main
  return {
    air: `inset(0 0 ${level}px 0)`,
    main: `inset(${height - level}px 0 ${bonus}px 0)`,
    bonus: `inset(${height - bonus}px 0 0 0)`,
  }
}

export interface StreamSegments {
  /** Nella spalla, in unità del suo viewBox (y da 0 a 60). */
  neck: { y: number; height: number }
  /** Nel corpo, in px dall'alto. */
  body: { y: number; height: number }
  bonus: boolean
}

/** Dove disegnare il getto: un pezzo nella spalla e uno nel corpo. */
export function streamSegments(liquid: Liquid): StreamSegments | null {
  const stream = liquid.stream
  if (!stream) return null
  const unit = SHOULDER_VIEWBOX / SHOULDER_PX
  const neckFrom = Math.min(stream.tail, STREAM_DROP_PX)
  const neckTo = Math.min(stream.head, STREAM_DROP_PX)
  const bodyFrom = Math.max(stream.tail - STREAM_DROP_PX, 0)
  const bodyTo = Math.max(stream.head - STREAM_DROP_PX, 0)
  return {
    neck: { y: CAP_BOTTOM + neckFrom * unit, height: Math.max(neckTo - neckFrom, 0) * unit },
    body: { y: bodyFrom, height: Math.max(bodyTo - bodyFrom, 0) },
    bonus: stream.bonus,
  }
}

/* ─── Utilità ───────────────────────────────────────────────── */

/** Da sinistra a destra lungo la linea, con un tratto dritto fino a oltre i bordi. Apre il tracciato. */
function forward(xs: number[], ys: number[], left: number, right: number): string {
  const last = xs.length - 1
  return `M${left} ${n(ys[0])}L${n(xs[0])} ${n(ys[0])}${curve(xs, ys)}L${right} ${n(ys[last])}`
}

/** La stessa linea da destra a sinistra, per chiudere una regione che la ha come bordo inferiore. */
function backward(xs: number[], ys: number[], left: number, right: number): string {
  const last = xs.length - 1
  return `L${right} ${n(ys[last])}L${n(xs[last])} ${n(ys[last])}${curve(reversed(xs), reversed(ys))}L${left} ${n(ys[0])}`
}

/** Curva morbida per i punti: quadratiche tra i punti medi, partendo dal primo (già raggiunto). */
function curve(xs: number[], ys: number[]): string {
  let d = ''
  for (let i = 1; i < xs.length - 1; i++) {
    if (i === 1) d += `L${n((xs[0] + xs[1]) / 2)} ${n((ys[0] + ys[1]) / 2)}`
    d += `Q${n(xs[i])} ${n(ys[i])} ${n((xs[i] + xs[i + 1]) / 2)} ${n((ys[i] + ys[i + 1]) / 2)}`
  }
  return `${d}L${n(xs[xs.length - 1])} ${n(ys[ys.length - 1])}`
}

function reversed(values: number[]): number[] {
  return [...values].reverse()
}

function n(value: number): number {
  return Math.round(value * 10) / 10
}

function zeroMean(values: Float64Array) {
  let sum = 0
  for (const v of values) sum += v
  const mean = sum / values.length
  for (let i = 0; i < values.length; i++) values[i] -= mean
}

function approach(value: number, target: number, rate: number): number {
  const next = value + (target - value) * rate
  return Math.abs(next - target) < EPS ? target : next
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
