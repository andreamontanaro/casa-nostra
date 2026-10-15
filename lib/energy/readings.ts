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

/** Quanto ha consumato un apparecchio negli ultimi 7 giorni, in kWh. */
export interface ApplianceConsumption {
  /** Codice di Fastweb (`fridge`, `washing_machine`, …): sceglie l'icona. */
  code: string | null
  /** Il nome come lo scrive Fastweb ("Frigorifero"). */
  name: string
  kwh: number
}

/** Un avviso di Power Control: interruzione della fornitura, distacco. */
export interface LoadNotice {
  /** Data e ora ISO, se Fastweb la dà. */
  at: string | null
  /** Tipo di Fastweb, es. `provider_disconnection` (interruzione della rete). */
  type: string | null
  title: string
  text: string | null
}

/** Tutto quello che cambia lentamente: si rilegge ogni mezz'ora, non a ogni giro. */
export interface EnergyDetails {
  /** Gli ultimi 7 giorni interi (oggi escluso), dal più vecchio. */
  days: DailyConsumption[]
  /** Totale dei 7 giorni e dei 7 prima, in kWh, per il confronto. */
  weekKwh: number | null
  previousWeekKwh: number | null
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
const MAX_NOTICES = 10

function cleanText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function nonNegative(value: unknown): number | null {
  const n = toNumber(value)
  return n !== null && n >= 0 ? n : null
}

/** Fastweb conta in Wh con dieci decimali: si tiene il Wh intero. */
function kwhFromWh(value: unknown): number | null {
  const wh = nonNegative(value)
  return wh === null ? null : Math.round(wh) / 1000
}

function isoInstant(value: unknown): string | null {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function byDate<T extends { date: string }>(a: T, b: T) {
  return a.date.localeCompare(b.date)
}

function newestFirst(a: LoadNotice, b: LoadNotice) {
  return (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0)
}

/** I dettagli salvati in cache, ricontrollati campo per campo. */
export function readStoredDetails(value: unknown): EnergyDetails | null {
  if (!isRecord(value)) return null
  const days = list(value.days).flatMap((item): DailyConsumption[] => {
    if (!isRecord(item) || typeof item.date !== 'string' || !ISO_DAY.test(item.date)) return []
    const kwh = nonNegative(item.kwh)
    return kwh === null ? [] : [{ date: item.date, kwh }]
  })
  const appliances = list(value.appliances).flatMap((item): ApplianceConsumption[] => {
    if (!isRecord(item)) return []
    const name = cleanText(item.name, 60)
    const kwh = nonNegative(item.kwh)
    return name && kwh !== null ? [{ code: cleanText(item.code, 40), name, kwh }] : []
  })
  const notices = list(value.notices).flatMap((item): LoadNotice[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 80)
    return title ? [{ at: isoInstant(item.at), type: cleanText(item.type, 40), title, text: cleanText(item.text, 240) }] : []
  })
  return {
    days: days.sort(byDate),
    weekKwh: nonNegative(value.weekKwh),
    previousWeekKwh: nonNegative(value.previousWeekKwh),
    appliances,
    plugOnline: typeof value.plugOnline === 'boolean' ? value.plugOnline : null,
    notices: notices.sort(newestFirst).slice(0, MAX_NOTICES),
  }
}

/** I `data` delle quattro risposte lente, così come arrivano (da ripulire). */
export interface RawDetails {
  daily: unknown
  appliances: unknown
  plugStatus: unknown
  loadNotify: unknown
}

/**
 * `consumptionMedium` (period `last-seven-days`): `totals.period` ha un
 * elemento per giorno, `{ day: "2026-10-08", total: <Wh>, … }`;
 * `medium_o.total_consumption` i totali in Wh dei 7 giorni e dei 7 prima.
 * (`medium_o` ha anche il numero di contratto: non si legge.)
 */
function parseDaily(data: unknown) {
  const totals = isRecord(data) && isRecord(data.totals) ? data.totals : null
  const days = list(totals?.period).flatMap((item): DailyConsumption[] => {
    if (!isRecord(item) || typeof item.day !== 'string') return []
    const date = item.day.slice(0, 10)
    const kwh = kwhFromWh(item.total)
    return ISO_DAY.test(date) && kwh !== null ? [{ date, kwh }] : []
  })
  const medium = isRecord(data) && isRecord(data.medium_o) ? data.medium_o : null
  const week = medium && isRecord(medium.total_consumption) ? medium.total_consumption : null
  return {
    days: days.sort(byDate),
    weekKwh: kwhFromWh(week?.selected_period),
    previousWeekKwh: kwhFromWh(week?.previous_period),
  }
}

/** `consumptionAppliancesHome`: `appliances` con `{ appliance, name_fe, power: <Wh> }`. */
function parseAppliances(data: unknown): ApplianceConsumption[] {
  return list(isRecord(data) ? data.appliances : null).flatMap((item): ApplianceConsumption[] => {
    if (!isRecord(item)) return []
    const code = cleanText(item.appliance, 40)
    const name = cleanText(item.name_fe, 60) ?? code
    const kwh = kwhFromWh(item.power)
    return name && kwh !== null ? [{ code, name, kwh }] : []
  })
}

/** `plugStatus`: `{ status: "ONLINE" }`. Un valore che non si conosce non accende l'avviso. */
function parsePlugStatus(data: unknown): boolean | null {
  const status = isRecord(data) && typeof data.status === 'string' ? data.status.trim().toUpperCase() : ''
  return status === 'ONLINE' ? true : status === 'OFFLINE' ? false : null
}

/** `loadNotify`: `notifications` con `{ type, title, message, created_at }`. */
function parseNotices(data: unknown): LoadNotice[] {
  const notices = list(isRecord(data) ? data.notifications : null).flatMap((item): LoadNotice[] => {
    if (!isRecord(item)) return []
    const title = cleanText(item.title, 80)
    return title
      ? [{ at: isoInstant(item.created_at), type: cleanText(item.type, 40), title, text: cleanText(item.message, 240) }]
      : []
  })
  return notices.sort(newestFirst).slice(0, MAX_NOTICES)
}

/** Consumi per giorno e per apparecchio, stato della presa e avvisi: solo i campi in elenco. */
export function parseDetails(raw: RawDetails): EnergyDetails {
  return {
    ...parseDaily(raw.daily),
    appliances: parseAppliances(raw.appliances),
    plugOnline: parsePlugStatus(raw.plugStatus),
    notices: parseNotices(raw.loadNotify),
  }
}
