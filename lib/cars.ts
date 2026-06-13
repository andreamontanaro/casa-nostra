import type { Tables } from '@/types/database'

export type Car = Tables<'cars'>
export type FuelEntry = Tables<'fuel_entries'>
export type OdometerReading = Tables<'odometer_readings'>

function round(n: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime()
  const db = new Date(`${b}T00:00:00`).getTime()
  return Math.round((db - da) / 86_400_000)
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/**
 * Km attuale dell'auto: il massimo tra km iniziale, l'odometro piu' alto
 * registrato nei rifornimenti e l'ultima lettura del contachilometri.
 */
export function currentKm(
  car: Pick<Car, 'initial_km'>,
  fuelEntries: Pick<FuelEntry, 'odometer_km'>[],
  odometerReadings: Pick<OdometerReading, 'km'>[],
): number {
  let max = car.initial_km ?? 0
  for (const e of fuelEntries) {
    if (e.odometer_km != null && e.odometer_km > max) max = e.odometer_km
  }
  for (const r of odometerReadings) {
    if (r.km > max) max = r.km
  }
  return max
}

// ---- Consumi (metodo pieno-a-pieno) ----

export type ConsumptionSegment = {
  date: string
  odometerKm: number
  distance: number
  liters: number
  cost: number
  lPer100km: number
  kmPerL: number
  costPerKm: number
}

export type ConsumptionStats = {
  segments: ConsumptionSegment[]
  avgLPer100km: number | null
  avgKmPerL: number | null
  avgCostPerKm: number | null
  totalLiters: number
  totalCost: number
}

/**
 * Calcola i consumi col metodo pieno-a-pieno: tra due rifornimenti "a pieno"
 * con odometro noto, i litri consumati sono la somma dei litri immessi DOPO il
 * primo pieno fino al secondo incluso, sulla distanza tra i due odometri.
 * I rifornimenti senza odometro o precedenti al primo pieno sono ignorati.
 */
export function computeConsumption(entries: FuelEntry[]): ConsumptionStats {
  const withOdo = entries
    .filter((e) => e.odometer_km != null)
    .slice()
    .sort((a, b) => a.odometer_km! - b.odometer_km!)

  const segments: ConsumptionSegment[] = []
  let prevFull: FuelEntry | null = null
  let litersAccum = 0
  let costAccum = 0

  for (const e of withOdo) {
    if (prevFull) {
      litersAccum += e.liters
      costAccum += e.total_cost
    }
    if (e.full_tank) {
      if (prevFull) {
        const distance = e.odometer_km! - prevFull.odometer_km!
        if (distance > 0 && litersAccum > 0) {
          segments.push({
            date: e.entry_date,
            odometerKm: e.odometer_km!,
            distance,
            liters: round(litersAccum, 2),
            cost: round(costAccum, 2),
            lPer100km: round((litersAccum / distance) * 100, 1),
            kmPerL: round(distance / litersAccum, 2),
            costPerKm: round(costAccum / distance, 3),
          })
        }
      }
      prevFull = e
      litersAccum = 0
      costAccum = 0
    }
  }

  if (segments.length === 0) {
    return {
      segments,
      avgLPer100km: null,
      avgKmPerL: null,
      avgCostPerKm: null,
      totalLiters: 0,
      totalCost: 0,
    }
  }

  const totDist = segments.reduce((s, x) => s + x.distance, 0)
  const totLit = segments.reduce((s, x) => s + x.liters, 0)
  const totCost = segments.reduce((s, x) => s + x.cost, 0)

  return {
    segments,
    avgLPer100km: round((totLit / totDist) * 100, 1),
    avgKmPerL: round(totDist / totLit, 2),
    avgCostPerKm: round(totCost / totDist, 3),
    totalLiters: round(totLit, 2),
    totalCost: round(totCost, 2),
  }
}

/**
 * Calcola il consumo medio basandosi sulle letture del contachilometri
 * che contengono l'indicazione del consumo del computer di bordo.
 * Restituisce i valori sia in L/100km che in km/L (media semplice).
 */
export function computeOdometerConsumptionStats(readings: OdometerReading[]): {
  avgLPer100km: number | null
  avgKmPerL: number | null
} {
  const valid = readings.filter(
    (r) => r.avg_consumption != null && r.consumption_unit != null
  )
  if (valid.length === 0) {
    return { avgLPer100km: null, avgKmPerL: null }
  }

  let sumLPer100km = 0
  for (const r of valid) {
    const val = Number(r.avg_consumption)
    if (r.consumption_unit === 'l_100km') {
      sumLPer100km += val
    } else {
      sumLPer100km += 100 / val
    }
  }

  const avgL = sumLPer100km / valid.length
  return {
    avgLPer100km: round(avgL, 1),
    avgKmPerL: round(100 / avgL, 2),
  }
}

/** Totali grezzi su tutti i rifornimenti (a prescindere dall'odometro). */
export function fuelTotals(entries: Pick<FuelEntry, 'liters' | 'total_cost'>[]) {
  let liters = 0
  let cost = 0
  for (const e of entries) {
    liters += e.liters
    cost += e.total_cost
  }
  return { liters: round(liters, 2), cost: round(cost, 2), count: entries.length }
}

// ---- Percorrenze ----

export type KmPoint = { date: string; km: number }

/**
 * Unisce in un'unica serie ordinata i punti km: km iniziale dell'auto (alla
 * data di creazione, solo se > 0), odometri dei rifornimenti e letture
 * indipendenti. In caso di piu' valori nello stesso giorno tiene il massimo.
 */
export function buildKmTimeline(
  car: Pick<Car, 'initial_km' | 'created_at'>,
  fuelEntries: Pick<FuelEntry, 'entry_date' | 'odometer_km'>[],
  odometerReadings: Pick<OdometerReading, 'reading_date' | 'km'>[],
): KmPoint[] {
  const byDate = new Map<string, number>()

  const add = (date: string, km: number) => {
    const cur = byDate.get(date)
    if (cur == null || km > cur) byDate.set(date, km)
  }

  if (car.initial_km > 0) add(car.created_at.slice(0, 10), car.initial_km)
  for (const e of fuelEntries) {
    if (e.odometer_km != null) add(e.entry_date, e.odometer_km)
  }
  for (const r of odometerReadings) add(r.reading_date, r.km)

  return [...byDate.entries()]
    .map(([date, km]) => ({ date, km }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export type DistancePeriod = 'day' | 'week' | 'month'
export type DistanceBucket = { key: string; label: string; km: number }
export type DistanceStats = {
  buckets: DistanceBucket[]
  totalKm: number
  totalDays: number
  avgPerDay: number
  avgPerBucket: number
}

const MONTHS_SHORT = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]

function bucketFor(
  date: string,
  period: DistancePeriod,
): { key: string; label: string } {
  const d = new Date(`${date}T00:00:00`)
  if (period === 'day') {
    return { key: date, label: `${d.getDate()}/${d.getMonth() + 1}` }
  }
  if (period === 'month') {
    const y = d.getFullYear()
    const m = d.getMonth()
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTHS_SHORT[m]} ${String(y).slice(2)}`,
    }
  }
  // settimana: lunedi' come inizio
  const offset = (d.getDay() + 6) % 7 // 0 = lunedi'
  const monday = new Date(d)
  monday.setDate(d.getDate() - offset)
  return {
    key: ymd(monday),
    label: `${monday.getDate()}/${monday.getMonth() + 1}`,
  }
}

/**
 * Distribuisce i km percorsi tra letture consecutive in modo proporzionale ai
 * giorni e li aggrega in bucket per giorno / settimana / mese. Ignora le
 * variazioni negative (dati incoerenti).
 */
export function computeDistanceStats(
  timeline: KmPoint[],
  period: DistancePeriod,
): DistanceStats {
  if (timeline.length < 2) {
    return { buckets: [], totalKm: 0, totalDays: 0, avgPerDay: 0, avgPerBucket: 0 }
  }

  const perDay = new Map<string, number>()
  let totalKm = 0

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1]
    const cur = timeline[i]
    const dist = cur.km - prev.km
    if (dist <= 0) continue
    const span = Math.max(1, daysBetween(prev.date, cur.date))
    const rate = dist / span
    totalKm += dist
    for (let k = 0; k < span; k++) {
      const day = addDays(prev.date, k)
      perDay.set(day, (perDay.get(day) ?? 0) + rate)
    }
  }

  const buckets = new Map<string, { label: string; km: number }>()
  for (const [day, km] of perDay) {
    const { key, label } = bucketFor(day, period)
    const b = buckets.get(key)
    if (b) b.km += km
    else buckets.set(key, { label, km })
  }

  const arr: DistanceBucket[] = [...buckets.entries()]
    .map(([key, v]) => ({ key, label: v.label, km: round(v.km, 0) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  const totalDays =
    daysBetween(timeline[0].date, timeline[timeline.length - 1].date) || 1
  const avgPerDay = round(totalKm / totalDays, 1)
  const avgPerBucket =
    arr.length > 0
      ? round(arr.reduce((s, x) => s + x.km, 0) / arr.length, 0)
      : 0

  return { buckets: arr, totalKm: round(totalKm, 0), totalDays, avgPerDay, avgPerBucket }
}

// ---- Logica del form rifornimento (3 valori, 2 inseriti) ----

export type FuelField = 'liters' | 'price' | 'total'

/**
 * Dato il campo appena modificato e i due valori correnti degli altri campi,
 * calcola il terzo valore quando possibile. La coda `recent` contiene i due
 * campi piu' recentemente modificati (escluso quello derivato).
 */
export function deriveFuelValue(
  derived: FuelField,
  liters: number,
  price: number,
  total: number,
): number | null {
  if (derived === 'total') {
    if (liters > 0 && price > 0) return round(liters * price, 2)
  } else if (derived === 'liters') {
    if (total > 0 && price > 0) return round(total / price, 2)
  } else if (derived === 'price') {
    if (total > 0 && liters > 0) return round(total / liters, 3)
  }
  return null
}
