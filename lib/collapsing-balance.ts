/**
 * Il saldo della home che, scorrendo, si comprime nella barra in cima allo
 * schermo (`components/BalanceStrip.tsx`): l'anello delle categorie si srotola in
 * una barra orizzontale e la cifra vola alla sua sinistra. Qui c'è solo la
 * geometria, pura e testata (`tests/collapsing-balance.test.mjs`): il
 * componente legge i rettangoli dal DOM e scrive tracciati e trasformazioni.
 *
 * Non c'è niente di dominio: la cifra che vola è quella già mostrata al
 * centro dell'anello, letta da `v_user_open_balance`.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface Flight {
  x: number
  y: number
  scale: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Partenza e arrivo dolci: la cifra accelera e frena invece di scattare. */
export function smoothstep(p: number): number {
  const t = clamp01(p)
  return t * t * (3 - 2 * t)
}

/**
 * Quanto è avanzata la compressione, da 0 (saldo nella card) a 1 (saldo nella
 * barra). Arriva a 1 quando il centro della cifra nella card, scorrendo,
 * raggiunge l'altezza del centro della barra: lì il volo è finito.
 *
 * `hero` e `target` sono rettangoli nella viewport (getBoundingClientRect),
 * `scrollY` lo scorrimento della pagina.
 */
export function collapseProgress(hero: Rect, target: Rect, scrollY: number): number {
  const heroCenter = hero.top + hero.height / 2 + scrollY
  const targetCenter = target.top + target.height / 2
  const distance = heroCenter - targetCenter
  if (distance <= 0) return scrollY > 0 ? 1 : 0
  return clamp01(scrollY / distance)
}

/**
 * Dove disegnare la copia della cifra che vola dalla card alla barra, con
 * `transform-origin` in alto a sinistra. Si interpolano i centri e la scala,
 * non gli angoli: centri allineati tengono allineato anche il testo quando le
 * due cifre hanno interlinea diversa. `clone` è la copia a scala 1, che ha il
 * carattere della card.
 */
export function flight(hero: Rect, target: Rect, clone: { width: number; height: number }, p: number): Flight {
  const e = smoothstep(p)
  const lerp = (from: number, to: number) => from + (to - from) * e
  const cx = lerp(hero.left + hero.width / 2, target.left + target.width / 2)
  const cy = lerp(hero.top + hero.height / 2, target.top + target.height / 2)
  const scale = lerp(1, hero.width > 0 ? target.width / hero.width : 1)
  return { x: cx - (clone.width * scale) / 2, y: cy - (clone.height * scale) / 2, scale }
}

/** Il fondo e la didascalia della barra compaiono nell'ultimo tratto del volo. */
export function stripOpacity(p: number): number {
  return clamp01((p - 0.6) / 0.4)
}

/** Proporzioni dell'anello in `SpendingRing`: viewBox 200, raggio 89, tratto 11. */
const RING_RADIUS = 89 / 200
const RING_STROKE = 11 / 200

export interface Unroll {
  /** Punti del tracciato, dall'inizio del giro (in cima all'anello). */
  points: [number, number][]
  strokeWidth: number
}

/**
 * L'anello che si srotola nella barra. Il tracciato resta un arco lungo
 * quanto serve: all'inizio è la circonferenza intera dell'anello, alla fine
 * è dritto e lungo quanto la barra. In mezzo la curvatura cala, come un
 * anello che si apre in cima e si stende; il punto più basso scivola dal
 * fondo dell'anello al centro della barra.
 *
 * Il giro va in senso orario dalla cima, come le fette dell'anello: steso,
 * corre quindi da destra a sinistra, e la prima fetta finisce a destra.
 * Con `pathLength="100"` le fette si disegnano con gli stessi
 * `strokeDasharray` dell'anello (`ringArcs` in `lib/spending.ts`).
 */
export function unroll(ring: Rect, bar: Rect, p: number, steps = 128): Unroll {
  const e = smoothstep(p)
  const lerp = (from: number, to: number) => from + (to - from) * e
  const r = ring.width * RING_RADIUS
  const length = lerp(2 * Math.PI * r, bar.width)
  const curvature = r > 0 ? (1 - e) / r : 0
  const mx = lerp(ring.left + ring.width / 2, bar.left + bar.width / 2)
  const my = lerp(ring.top + ring.height / 2 + r, bar.top + bar.height / 2)
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * length - length / 2
    if (curvature * length < 1e-6) {
      points.push([mx - s, my])
    } else {
      const angle = curvature * s
      points.push([mx - Math.sin(angle) / curvature, my - (1 - Math.cos(angle)) / curvature])
    }
  }
  return { points, strokeWidth: lerp(ring.width * RING_STROKE, bar.height) }
}

/** I punti di `unroll` come attributo `d` di un `<path>`. */
export function pathData(points: readonly [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')
}
