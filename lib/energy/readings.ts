/**
 * Letture di Fastweb Power Control già ripulite, e le regole per mostrarle.
 *
 * Funzioni pure, senza import: le usano la rotta (`lib/energy/service.ts`),
 * la schermata (`app/(app)/energia/`) e i test (`tests/energy.test.mjs`).
 *
 * Le risposte di MyFastweb contengono anche i dati dell'intestatario (codice
 * fiscale, email, POD, numero cliente in `realtime_sin`). Qui si leggono solo
 * i campi in elenco, uno per uno, e se ne costruiscono di nuovi: nessuno
 * spread di `data`, così un campo personale non può passare per sbaglio.
 */

/** Potenza istantanea: solo numeri. */
export interface RealtimeReading {
  /** Potenza assorbita in questo momento, in W. */
  watts: number
  /** Massimo sopportabile dal contatore, in kW (`realtime_max`); null se manca. */
  limitKw: number | null
}

/** Consumo di un giorno, in kWh. `date` è AAAA-MM-GG. */
export interface DailyConsumption {
  date: string
  kwh: number
}

/** Quanto ha consumato un apparecchio nel periodo, in kWh. */
export interface ApplianceConsumption {
  name: string
  kwh: number
}

/** Un avviso di distacco (o di carico vicino al limite) registrato da Fastweb. */
export interface LoadNotice {
  /** Data e ora ISO, se Fastweb la dà. */
  at: string | null
  text: string
}

/** Tutto quello che cambia lentamente: si rilegge ogni mezz'ora, non a ogni giro. */
export interface EnergyDetails {
  days: DailyConsumption[]
  appliances: ApplianceConsumption[]
  /** La presa Power Control risponde? null se non si sa. */
  plugOnline: boolean | null
  notices: LoadNotice[]
}

/**
 * - `ok`: lettura riuscita (o in cache e ancora fresca);
 * - `spento`: mancano le credenziali, l'integrazione non è attiva;
 * - `captcha`: Fastweb ha chiesto il captcha, non si riprova fino a `retryAt`;
 * - `rifiutato`: credenziali rifiutate, non si riprova fino a `retryAt`;
 * - `errore`: Fastweb non ha risposto come previsto; si mostra l'ultima lettura.
 */
export type EnergyStatus = 'ok' | 'spento' | 'captcha' | 'rifiutato' | 'errore'

export interface EnergySnapshot {
  status: EnergyStatus
  realtime: RealtimeReading | null
  /** Quando è stata letta la potenza (ISO). */
  realtimeAt: string | null
  details: EnergyDetails | null
  detailsAt: string | null
  /** Dopo un captcha, un rifiuto o un errore: quando si riproverà (ISO). */
  retryAt: string | null
}

/** Il contatore domestico standard: 3 kW. Vale quando Fastweb non dà `realtime_max`. */
export const DEFAULT_LIMIT_KW = 3

/** Sopra questa frazione del limite la batteria passa a "attenzione". */
export const WARNING_RATIO = 0.7

export type BatteryBand = 'tranquillo' | 'attenzione' | 'oltre'

export interface BatteryLevel {
  /** Riempimento della batteria, da 0 a 1. */
  fill: number
  /** Percentuale vera rispetto al limite (può superare 100). */
  percent: number
  band: BatteryBand
  limitKw: number
}

/** Quanto è piena la batteria: la potenza di adesso rispetto al massimo sopportabile. */
export function batteryLevel(watts: number, limitKw: number | null): BatteryLevel {
  const limit = limitKw !== null && limitKw > 0 ? limitKw : DEFAULT_LIMIT_KW
  const ratio = Math.max(0, watts) / (limit * 1000)
  const band: BatteryBand = ratio > 1 ? 'oltre' : ratio >= WARNING_RATIO ? 'attenzione' : 'tranquillo'
  return { fill: Math.min(1, ratio), percent: Math.round(ratio * 100), band, limitKw: limit }
}

export const BATTERY_BAND_LABEL: Record<BatteryBand, string> = {
  tranquillo: 'Lontano dal limite',
  attenzione: 'Vicino al limite: meglio non accendere altro',
  oltre: 'Oltre il limite: il contatore potrebbe staccare',
}

// ─── Lettura delle risposte ────────────────────────────────────

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Messaggio di un errore per i log: quelli di Supabase non sono `Error`. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (isRecord(error) && typeof error.message === 'string') return error.message
  return String(error)
}

/**
 * Un numero da JSON: Fastweb a volte manda stringhe, anche all'italiana
 * ("1.234,5"). Restituisce null per tutto quello che non è un numero finito.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  let text = value.trim()
  if (!/^-?[\d.,]+$/.test(text)) return null
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '')
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/** `data` della risposta realtime → potenza e limite. Tutto il resto si perde qui. */
export function parseRealtime(data: unknown): RealtimeReading | null {
  if (!isRecord(data)) return null
  const watts = toNumber(data.realtime)
  if (watts === null || watts < 0) return null
  const limit = toNumber(data.realtime_max)
  return { watts: Math.round(watts), limitKw: limit !== null && limit > 0 ? limit : null }
}

/** La lettura salvata in cache, riletta con le stesse regole. */
export function readStoredRealtime(value: unknown): RealtimeReading | null {
  if (!isRecord(value)) return null
  const watts = toNumber(value.watts)
  if (watts === null || watts < 0) return null
  const limit = toNumber(value.limitKw)
  return { watts, limitKw: limit !== null && limit > 0 ? limit : null }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** I dettagli salvati in cache, ricontrollati campo per campo. */
export function readStoredDetails(value: unknown): EnergyDetails | null {
  if (!isRecord(value)) return null
  const days: DailyConsumption[] = []
  for (const item of Array.isArray(value.days) ? value.days : []) {
    if (!isRecord(item) || typeof item.date !== 'string' || !ISO_DAY.test(item.date)) continue
    const kwh = toNumber(item.kwh)
    if (kwh !== null && kwh >= 0) days.push({ date: item.date, kwh })
  }
  const appliances: ApplianceConsumption[] = []
  for (const item of Array.isArray(value.appliances) ? value.appliances : []) {
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim()) continue
    const kwh = toNumber(item.kwh)
    if (kwh !== null && kwh >= 0) appliances.push({ name: item.name.trim().slice(0, 60), kwh })
  }
  const notices: LoadNotice[] = []
  for (const item of Array.isArray(value.notices) ? value.notices : []) {
    if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim()) continue
    notices.push({ at: typeof item.at === 'string' ? item.at : null, text: item.text.trim().slice(0, 200) })
  }
  const plugOnline = typeof value.plugOnline === 'boolean' ? value.plugOnline : null
  return { days, appliances, plugOnline, notices }
}

/** I `data` delle quattro risposte lente, così come arrivano (da ripulire). */
export interface RawDetails {
  daily: unknown
  appliances: unknown
  plugStatus: unknown
  loadNotify: unknown
}

/**
 * Consumi per giorno e per apparecchio, stato della presa e avvisi.
 * PROVVISORIO: la forma di queste risposte si legge con la modalità
 * diagnostica di `/api/energia` sull'anteprima; fino ad allora non se ne
 * prende niente.
 */
export function parseDetails(raw: RawDetails): EnergyDetails {
  void raw
  return { days: [], appliances: [], plugOnline: null, notices: [] }
}
