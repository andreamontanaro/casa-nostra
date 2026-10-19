import type { PowerPoint } from './readings'

/**
 * Il grafico delle ultime 6 ore: scala, tacche, punto più vicino, kWh.
 * Funzioni pure, come `readings.ts` (l'import sopra è solo di tipo): le usa
 * `components/energy/PowerHistoryChart.tsx` e le verifica
 * `tests/energy.test.mjs`.
 */

export const WINDOW_MS = 6 * 60 * 60_000
/** Due punti più distanti di così non si uniscono: la presa non ha misurato. */
export const GAP_MS = 5 * 60_000

export interface HistoryScale {
  /** Il valore in cima al grafico, in W. */
  topWatts: number
  /** Le righe della griglia, in W, da 0 a `topWatts`. */
  ticks: number[]
  /** Il limite del contatore sta nel grafico: si disegna la sua riga. */
  showLimit: boolean
}

const STEPS = [100, 250, 500, 1000, 2000, 5000]

/**
 * La scala segue il picco, come il grafico di Fastweb: con 200 W di base la
 * linea non resta schiacciata sul fondo. Quando il picco si avvicina al
 * limite (85%) la scala arriva almeno al limite e lo mostra.
 */
export function historyScale(peakWatts: number, limitWatts: number): HistoryScale {
  let top = Math.max(peakWatts * 1.15, 500)
  const showLimit = peakWatts >= limitWatts * 0.85
  if (showLimit) top = Math.max(top, limitWatts * 1.05)
  // Il passo più fine che dà al massimo 7 intervalli, poi la cima arrotondata a quel passo.
  const step = STEPS.find((s) => top / s <= 7) ?? STEPS[STEPS.length - 1]
  const topWatts = Math.ceil(top / step) * step
  const ticks = Array.from({ length: Math.round(topWatts / step) + 1 }, (_, i) => i * step)
  return { topWatts, ticks, showLimit }
}

/** Le ore piene tra `fromMs` e `toMs`. L'Italia è a un'ora intera da UTC: l'ora piena è la stessa. */
export function hourTicks(fromMs: number, toMs: number): number[] {
  const hour = 60 * 60_000
  const ticks: number[] = []
  for (let t = Math.ceil(fromMs / hour) * hour; t <= toMs; t += hour) ticks.push(t)
  return ticks
}

/** L'indice del punto più vicino all'istante, per il cursore. -1 se non ci sono punti. */
export function nearestIndex(points: PowerPoint[], atMs: number): number {
  if (!points.length) return -1
  let lo = 0
  let hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (Date.parse(points[mid].at) < atMs) lo = mid + 1
    else hi = mid
  }
  if (lo > 0 && Math.abs(Date.parse(points[lo - 1].at) - atMs) <= Math.abs(Date.parse(points[lo].at) - atMs)) return lo - 1
  return lo
}

/** I tratti continui della serie: un buco di misura spezza la linea. */
export function segments(points: PowerPoint[]): PowerPoint[][] {
  const out: PowerPoint[][] = []
  for (const point of points) {
    const last = out[out.length - 1]
    const prev = last?.[last.length - 1]
    if (prev && Date.parse(point.at) - Date.parse(prev.at) <= GAP_MS) last.push(point)
    else out.push([point])
  }
  return out
}

export interface HistorySummary {
  peak: PowerPoint
  averageWatts: number
  /** Energia consumata nella finestra (trapezi tra punti vicini), in kWh. */
  kwh: number
}

export function summarize(points: PowerPoint[]): HistorySummary | null {
  if (!points.length) return null
  let peak = points[0]
  let wattHours = 0
  for (let i = 0; i < points.length; i++) {
    if (points[i].watts > peak.watts) peak = points[i]
    if (i === 0) continue
    const dt = Date.parse(points[i].at) - Date.parse(points[i - 1].at)
    if (dt > 0 && dt <= GAP_MS) wattHours += ((points[i].watts + points[i - 1].watts) / 2) * (dt / 3_600_000)
  }
  const averageWatts = Math.round(points.reduce((sum, p) => sum + p.watts, 0) / points.length)
  return { peak, averageWatts, kwh: wattHours / 1000 }
}

export interface HalfHourRow {
  /** Inizio della mezz'ora (ISO). */
  from: string
  averageWatts: number
  peakWatts: number
}

/** Media e picco per mezz'ora, per la tabella sotto il grafico. Dalla più recente. */
export function halfHourRows(points: PowerPoint[]): HalfHourRow[] {
  const half = 30 * 60_000
  const groups = new Map<number, number[]>()
  for (const point of points) {
    const start = Math.floor(Date.parse(point.at) / half) * half
    groups.set(start, [...(groups.get(start) ?? []), point.watts])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([start, watts]) => ({
      from: new Date(start).toISOString(),
      averageWatts: Math.round(watts.reduce((s, w) => s + w, 0) / watts.length),
      peakWatts: Math.max(...watts),
    }))
}
