/**
 * Il liquido delle bottiglie in 3D, in funzioni pure: niente three.js, niente
 * DOM, niente sensori. La scena (`lib/chores/bottles3d/scene.ts`, caricata
 * solo quando si sceglie la vista 3D) lo fa avanzare e lo disegna; qui c'è
 * quello che si può provare con `node --test`.
 *
 * Il modello è lo stesso delle bottiglie 2D (`liquid.ts`), con una dimensione
 * in più:
 * - **il volume**: due strati, il bonus in fondo e le faccende sopra. Il
 *   livello da raggiungere è sempre tacche piene × altezza della tacca, a
 *   bottiglia dritta: la fisica muove solo il disegno;
 * - **il piano**: la superficie è un piano perpendicolare alla gravità che il
 *   liquido sente, a volume costante dentro la bottiglia vera (fondo
 *   arrotondato, spalla, collo). Quasi vuota e inclinata, il liquido si
 *   raccoglie da una parte;
 * - **le onde**: sopra il piano una griglia nel disco della bottiglia con
 *   l'equazione delle onde, bordi che riflettono e media nulla (il volume sta
 *   tutto nel piano). Lo sciabordio è la sua onda più lunga.
 *
 * Unità di scena e secondi. Le coordinate sono quelle della bottiglia: y
 * lungo l'asse, da 0 sul fondo interno; x e z nella sezione.
 */

/** Altezza di una tacca: i 56 px della bottiglia 2D. */
export const NOTCH_H = 0.5
/** Raggio interno del corpo. */
export const INNER_R = 0.84
/** Spessore del vetro. */
export const GLASS_T = 0.055
export const OUTER_R = INNER_R + GLASS_T
/** Raggio dello spigolo interno sul fondo. */
export const BOTTOM_R = 0.16
/** Fondo di vetro pieno sotto il liquido. */
export const BASE_T = 0.17
export const SHOULDER_H = 0.42
/** Raggio interno del collo. */
export const NECK_R = 0.18
export const NECK_H = 0.26
export const CAP_R = 0.3
export const CAP_H = 0.2
/** Gravità in unità/s²: con questa misura lo sciabordio va a circa un colpo e mezzo al secondo. */
export const GRAVITY = 72

/** Celle della griglia delle onde lungo il diametro. */
export const WAVE_CELLS = 36
const WAVE_SPEED = 4.4
const WAVE_DAMPING = 1.3
const WAVE_VISCOSITY = 0.02
/** Oltre questa ampiezza la superficie non si alza né si abbassa: tiene a bada gli scossoni. */
const WAVE_LIMIT = 0.45
/** Sotto questa ampiezza le onde si considerano ferme. */
export const WAVE_REST = 1e-3
/** Fette orizzontali per il calcolo del volume. */
const SLICES = 110

/** Il raggio interno della bottiglia all'altezza y, con il corpo alto `bodyH`. */
export function innerRadius(y: number, bodyH: number): number {
  if (y < 0) return 0
  if (y < BOTTOM_R) {
    const d = BOTTOM_R - y
    return INNER_R - BOTTOM_R + Math.sqrt(Math.max(BOTTOM_R * BOTTOM_R - d * d, 0))
  }
  if (y <= bodyH) return INNER_R
  const t = (y - bodyH) / SHOULDER_H
  if (t <= 1) return NECK_R + (INNER_R - NECK_R) * (0.5 + 0.5 * Math.cos(Math.PI * t))
  if (y <= bodyH + SHOULDER_H + NECK_H) return NECK_R
  return 0
}

/** Area della parte di un cerchio di raggio r oltre la retta a distanza d dal centro. */
export function segmentArea(r: number, d: number): number {
  if (d <= -r) return Math.PI * r * r
  if (d >= r) return 0
  return r * r * Math.acos(d / r) - d * Math.sqrt(r * r - d * d)
}

/** L'interno di una bottiglia, a fette, per il calcolo del volume. */
export interface Vessel {
  notches: number
  bodyH: number
  /** Dal fondo interno all'imboccatura. */
  top: number
  dy: number
  radii: Float64Array
}

export function createVessel(notches: number): Vessel {
  const bodyH = notches * NOTCH_H
  const top = bodyH + SHOULDER_H + NECK_H
  const dy = top / SLICES
  const radii = new Float64Array(SLICES)
  for (let i = 0; i < SLICES; i++) radii[i] = innerRadius((i + 0.5) * dy, bodyH)
  return { notches, bodyH, top, dy, radii }
}

/**
 * Il volume sotto il piano y = c + sx·x + sz·z. La pendenza (sx, sz) è nel
 * riferimento del liquido; l'interno è a simmetria di rivoluzione, quindi
 * conta solo quanto è ripida.
 */
export function volumeBelow(vessel: Vessel, c: number, sx: number, sz: number): number {
  const m = Math.hypot(sx, sz)
  const { radii, dy } = vessel
  let volume = 0
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i]
    if (r <= 0) continue
    const y = (i + 0.5) * dy
    if (m < 1e-6) {
      // dritta: la fetta tagliata dal livello conta per la parte sotto
      volume += Math.PI * r * r * Math.min(Math.max(c - i * dy, 0), dy)
    } else {
      volume += segmentArea(r, (y - c) / m) * dy
    }
  }
  return volume
}

/** Il volume di una bottiglia dritta riempita fino a `level`. */
export function levelVolume(vessel: Vessel, level: number): number {
  return volumeBelow(vessel, level, 0, 0)
}

/** La quota al centro del piano con pendenza (sx, sz) che contiene `volume`. */
export function solveLevel(vessel: Vessel, volume: number, sx: number, sz: number): number {
  if (volume <= 1e-6) return -10
  const m = Math.hypot(sx, sz)
  let lo = -m * INNER_R - 0.05
  let hi = vessel.top + m * INNER_R + 0.05
  for (let k = 0; k < 26; k++) {
    const mid = 0.5 * (lo + hi)
    if (volumeBelow(vessel, mid, sx, sz) < volume) lo = mid
    else hi = mid
  }
  return 0.5 * (lo + hi)
}

/**
 * La pendenza del piano perpendicolare a `up` (la direzione opposta alla
 * gravità, nel riferimento del liquido). Oltre ~73° si smette di inclinare.
 */
export function slopeFromUp(up: { x: number; y: number; z: number }): { x: number; z: number } {
  const y = Math.max(up.y, 0.3)
  return { x: -up.x / y, z: -up.z / y }
}

/** La velocità delle onde: più lente dove il liquido è basso, come in acqua bassa. */
export function waveSpeed(depth: number): number {
  return WAVE_SPEED * Math.sqrt(Math.tanh((1.84 * Math.max(depth, 0)) / INNER_R))
}

/* ─── Onde ─────────────────────────────────────────────────────────────── */

export interface Waves {
  n: number
  dx: number
  /** Altezza e velocità verticale di ogni cella. */
  h: Float32Array
  v: Float32Array
  /** Centro delle celle. */
  px: Float32Array
  pz: Float32Array
  /** Le celle dentro il disco. */
  cells: Int32Array
  isIn: Uint8Array
  /** I quattro vicini di ogni cella (sé stessa oltre il bordo: il bordo riflette). */
  nb: Int32Array
  /** Per le celle fuori dal disco, la cella dentro più vicina. */
  near: Int32Array
  outside: Int32Array
  lh: Float32Array
  lv: Float32Array
  awake: boolean
}

export function createWaves(n = WAVE_CELLS): Waves {
  const size = n * n
  const dx = (2 * INNER_R) / n
  const px = new Float32Array(size)
  const pz = new Float32Array(size)
  const isIn = new Uint8Array(size)
  const inside: number[] = []
  const lim = INNER_R - dx * 0.35
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      const x = -INNER_R + (i + 0.5) * dx
      const z = -INNER_R + (j + 0.5) * dx
      px[k] = x
      pz[k] = z
      if (x * x + z * z < lim * lim) {
        isIn[k] = 1
        inside.push(k)
      }
    }
  }
  const nb = new Int32Array(size * 4)
  for (const k of inside) {
    const i = k % n
    const j = (k / n) | 0
    const pick = (ii: number, jj: number) => {
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) return k
      const kk = jj * n + ii
      return isIn[kk] ? kk : k
    }
    nb[4 * k] = pick(i - 1, j)
    nb[4 * k + 1] = pick(i + 1, j)
    nb[4 * k + 2] = pick(i, j - 1)
    nb[4 * k + 3] = pick(i, j + 1)
  }
  const near = new Int32Array(size)
  const outside: number[] = []
  for (let k = 0; k < size; k++) {
    if (isIn[k]) continue
    let best = inside[0]
    let bestD = Infinity
    for (const c of inside) {
      const d = (px[c] - px[k]) ** 2 + (pz[c] - pz[k]) ** 2
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    near[k] = best
    outside.push(k)
  }
  return {
    n,
    dx,
    h: new Float32Array(size),
    v: new Float32Array(size),
    px,
    pz,
    cells: Int32Array.from(inside),
    isIn,
    nb,
    near,
    outside: Int32Array.from(outside),
    lh: new Float32Array(size),
    lv: new Float32Array(size),
    awake: false,
  }
}

/** Un passo dell'equazione delle onde, con smorzamento e un po' di viscosità (spegne le increspature corte). */
export function stepWaves(w: Waves, dt: number, speed: number) {
  const { h, v, lh, lv, nb, cells } = w
  const inv = 1 / (w.dx * w.dx)
  const c2 = speed * speed
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    const a = nb[4 * k]
    const b = nb[4 * k + 1]
    const d = nb[4 * k + 2]
    const e = nb[4 * k + 3]
    lh[k] = (h[a] + h[b] + h[d] + h[e] - 4 * h[k]) * inv
    lv[k] = (v[a] + v[b] + v[d] + v[e] - 4 * v[k]) * inv
  }
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    v[k] += (c2 * lh[k] - WAVE_DAMPING * v[k] + WAVE_VISCOSITY * lv[k]) * dt
  }
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    h[k] += v[k] * dt
  }
}

/**
 * La pendenza di equilibrio è cambiata di (dsx, dsz): il liquido non la segue
 * subito, resta dov'era e da lì oscilla. È questo lo sciabordio.
 */
export function forceWaves(w: Waves, dsx: number, dsz: number) {
  const { h, px, pz, cells } = w
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    h[k] -= dsx * px[k] + dsz * pz[k]
  }
  w.awake = true
}

/** Una spinta verticale attorno a (x, z): un tocco, una goccia, il getto. */
export function kickWaves(w: Waves, x: number, z: number, amount: number, radius: number) {
  const { v, px, pz, cells } = w
  const r2 = radius * radius
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    const d2 = (px[k] - x) ** 2 + (pz[k] - z) ** 2
    if (d2 < 9 * r2) v[k] += amount * Math.exp(-d2 / r2)
  }
  w.awake = true
}

/** Riporta la media a zero e limita l'ampiezza. Restituisce quanto si muove ancora. */
export function settleWaves(w: Waves): number {
  const { h, v, cells } = w
  let sum = 0
  for (let n = 0; n < cells.length; n++) sum += h[cells[n]]
  const mean = sum / cells.length
  let maxH = 0
  let maxV = 0
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    const x = Math.min(Math.max(h[k] - mean, -WAVE_LIMIT), WAVE_LIMIT)
    h[k] = x
    maxH = Math.max(maxH, Math.abs(x))
    maxV = Math.max(maxV, Math.abs(v[k]))
  }
  return Math.max(maxH, maxV * 0.08)
}

export function clearWaves(w: Waves) {
  w.h.fill(0)
  w.v.fill(0)
  w.awake = false
}

/** L'altezza delle onde nel punto (x, z) del riferimento del liquido. */
export function sampleWaves(w: Waves, x: number, z: number): number {
  const i = Math.min(Math.max(Math.round((x + INNER_R) / w.dx - 0.5), 0), w.n - 1)
  const j = Math.min(Math.max(Math.round((z + INNER_R) / w.dx - 0.5), 0), w.n - 1)
  const k = j * w.n + i
  return w.h[w.isIn[k] ? k : w.near[k]]
}

/**
 * Le onde come texture RGBA a mezza precisione: altezza e le due pendenze. Le
 * celle fuori dal disco copiano la più vicina, così il filtro lineare sul
 * bordo non tira giù la superficie.
 */
export function packWaves(w: Waves, out: Uint16Array) {
  const { h, nb, cells, near, outside } = w
  const inv = 1 / (2 * w.dx)
  for (let n = 0; n < cells.length; n++) {
    const k = cells[n]
    out[4 * k] = toHalf(h[k])
    out[4 * k + 1] = toHalf((h[nb[4 * k + 1]] - h[nb[4 * k]]) * inv)
    out[4 * k + 2] = toHalf((h[nb[4 * k + 3]] - h[nb[4 * k + 2]]) * inv)
  }
  for (let n = 0; n < outside.length; n++) {
    const k = outside[n]
    const s = near[k]
    out[4 * k] = out[4 * s]
    out[4 * k + 1] = out[4 * s + 1]
    out[4 * k + 2] = out[4 * s + 2]
  }
}

const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

/** Da float a 16 bit (IEEE 754 half), troncando: basta per altezze di qualche decimo. */
export function toHalf(value: number): number {
  f32[0] = value
  const x = u32[0]
  const sign = (x >> 16) & 0x8000
  const e = ((x >> 23) & 0xff) - 112
  const m = x & 0x7fffff
  if (e <= 0) {
    if (e < -10) return sign
    return sign | (((m | 0x800000) >> (1 - e)) >> 13)
  }
  if (e >= 31) return sign | 0x7bff
  return sign | (e << 10) | (m >> 13)
}

/* ─── Inquadratura ────────────────────────────────────────────────────── */

/** Distanza dal centro della scena al centro di ogni bottiglia. */
export const BOTTLE_X = 1.13
/** Mezza larghezza inquadrata: due bottiglie e un po' d'aria per inclinarle. */
export const HALF_WIDTH = 2.42

/**
 * Le bottiglie sono allineate in alto, come in 2D: il corpo finisce alla
 * stessa quota per entrambe, quindi la tacca bonus sta sotto il fondo
 * dell'altra e due bottiglie pari hanno il liquido alla stessa altezza.
 * L'inquadratura dipende solo dalla bottiglia più lunga.
 */
export function framing(maxNotches: number) {
  const topY = maxNotches * NOTCH_H
  // sotto: il fondo di vetro e l'ombra, che con la camera un po' alta scende
  const bottom = -BASE_T - 0.45
  // sopra: il tappo, più lo spazio per i nomi
  const top = topY + SHOULDER_H + NECK_H + 0.12 + 0.62
  const halfHeight = (top - bottom) / 2
  return {
    topY,
    centerY: (top + bottom) / 2,
    halfHeight,
    /** Larghezza / altezza del riquadro, senza i margini in cui sborda il canvas. */
    aspect: HALF_WIDTH / halfHeight,
  }
}
