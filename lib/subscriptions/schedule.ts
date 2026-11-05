/**
 * Calendario degli abbonamenti: quando cade un addebito, quando parte il
 * promemoria. Modulo puro, senza import, testato da
 * `tests/subscriptions.test.mjs`.
 *
 * Le date sono stringhe `YYYY-MM-DD` nel fuso della casa (Europe/Rome), come
 * `expense_date`: niente oggetti Date in giro, così l'ora legale non può
 * spostare un addebito di un giorno.
 *
 * Un abbonamento ha un giorno del mese (`chargeDay`, 1-31), ogni quanti mesi
 * (`intervalMonths`) e il mese del primo addebito (`startMonth`, sempre il
 * primo del mese). L'addebito k-esimo cade nel mese `startMonth + k ·
 * intervalMonths`, il giorno `chargeDay` — o l'ultimo del mese, se il mese è
 * più corto (il 31 a febbraio diventa il 28 o il 29). Ogni addebito si calcola
 * dal mese di partenza, non dal precedente: dopo febbraio si torna al 31.
 */

export const INTERVAL_OPTIONS = [1, 2, 3, 6, 12] as const
export type IntervalMonths = (typeof INTERVAL_OPTIONS)[number]

/** Quanti giorni prima dell'addebito arriva il promemoria su Telegram. */
export const REMINDER_DAYS_BEFORE = 3

/**
 * Quanto indietro si recuperano gli addebiti non registrati (cron fermo,
 * Supabase in pausa). Rete di sicurezza: in condizioni normali l'addebito
 * si registra il giorno stesso.
 */
export const CATCH_UP_DAYS = 40

export const INTERVAL_LABELS: Record<number, string> = {
  1: 'Mensile',
  2: 'Bimestrale',
  3: 'Trimestrale',
  6: 'Semestrale',
  12: 'Annuale',
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

export interface Cadence {
  chargeDay: number
  intervalMonths: number
  /** `YYYY-MM-01`: il mese del primo addebito. */
  startMonth: string
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(iso: string): { y: number; m: number; d: number } {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`Data non valida: ${iso}`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const { y, m, d } = parts(value)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

/** Giorni del mese `m` (1-12) dell'anno `y`. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** La data `iso` spostata di `days` giorni (anche negativi). */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parts(iso)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

/** Giorni da `from` a `to`: positivo se `to` viene dopo. */
export function daysBetween(from: string, to: string): number {
  const a = parts(from)
  const b = parts(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

function monthIndex(iso: string): number {
  const { y, m } = parts(iso)
  return y * 12 + (m - 1)
}

/** La cadenza che ha `firstDue` come primo addebito. */
export function cadenceFromDate(firstDue: string, intervalMonths: number): Cadence {
  const { y, m, d } = parts(firstDue)
  return { chargeDay: d, intervalMonths, startMonth: toIso(y, m, 1) }
}

/** La data dell'addebito k-esimo (k = 0 è il primo). */
export function occurrence(cadence: Cadence, k: number): string {
  const index = monthIndex(cadence.startMonth) + k * cadence.intervalMonths
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  return toIso(y, m, Math.min(cadence.chargeDay, daysInMonth(y, m)))
}

/** Il primo addebito che cade il giorno `from` o dopo. */
export function nextDueOn(cadence: Cadence, from: string): string {
  const monthsAhead = monthIndex(from) - monthIndex(cadence.startMonth)
  let k = Math.max(0, Math.floor(monthsAhead / cadence.intervalMonths) - 1)
  while (occurrence(cadence, k) < from) k++
  return occurrence(cadence, k)
}

/**
 * Gli addebiti da registrare entro `through` (compreso), dal più vecchio:
 * tutti quelli dal primo in poi, ma non più vecchi di `CATCH_UP_DAYS`.
 */
export function dueDatesThrough(cadence: Cadence, through: string): string[] {
  const oldest = addDays(through, -CATCH_UP_DAYS)
  const dates: string[] = []
  for (let due = nextDueOn(cadence, oldest); due <= through; ) {
    dates.push(due)
    due = nextDueOn(cadence, addDays(due, 1))
  }
  return dates
}

/**
 * L'addebito per cui `today` è il giorno del promemoria, se c'è: il prossimo
 * dopo oggi, se cade entro `REMINDER_DAYS_BEFORE` giorni. Di norma il
 * promemoria parte esattamente 3 giorni prima; se quel giorno è saltato (o
 * l'abbonamento è nato a ridosso dell'addebito) parte appena possibile, finché
 * l'addebito è ancora nel futuro.
 */
export function reminderDueOn(cadence: Cadence, today: string): string | null {
  const next = nextDueOn(cadence, addDays(today, 1))
  return daysBetween(today, next) <= REMINDER_DAYS_BEFORE ? next : null
}

/** «Ogni mese, il giorno 8» · «Ogni 3 mesi, il giorno 31» · «Ogni anno, l'8 dicembre». */
export function cadenceLabel(cadence: Cadence, nextDue?: string): string {
  const { chargeDay, intervalMonths } = cadence
  if (intervalMonths === 12) {
    const month = MONTH_NAMES[parts(nextDue ?? cadence.startMonth).m - 1]
    const article = chargeDay === 8 || chargeDay === 11 ? 'l’' : 'il '
    return `Ogni anno, ${article}${chargeDay === 1 ? '1º' : chargeDay} ${month}`
  }
  const every = intervalMonths === 1 ? 'Ogni mese' : `Ogni ${intervalMonths} mesi`
  return `${every}, il giorno ${chargeDay}`
}

/** «oggi», «domani», «fra 3 giorni». */
export function relativeDays(days: number): string {
  if (days <= 0) return 'oggi'
  if (days === 1) return 'domani'
  return `fra ${days} giorni`
}

/** Quanto pesa al mese: 120 € ogni 6 mesi sono 20 € al mese. */
export function monthlyAmount(amount: number, intervalMonths: number): number {
  return amount / intervalMonths
}

const ROME_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** Data (`YYYY-MM-DD`) e ora (0-23) di questo istante nel fuso della casa. */
export function romeClock(now: Date): { date: string; hour: number } {
  const all = ROME_CLOCK.formatToParts(now)
  const get = (type: string) => all.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}
