/**
 * Le due bottiglie delle faccende, in funzioni pure: quali tacche sono piene
 * e che cosa dire sotto. I conti veri — livelli, arretrato, faccende che
 * mancano alla parità — li fa `v_chore_balance` sul database; qui si decide
 * solo come mostrarli, come `BalanceCard` fa con `v_user_open_balance`.
 */

/** Tacche di una bottiglia senza bonus: chi non lavora da casa, e tutti nel weekend. */
export const BASE_NOTCHES = 5

/** Lunghezza massima del nome: sta scritto dentro la tacca (vincolo anche sul DB). */
export const CHORE_NAME_MAX = 40

/** Una riga di `v_chore_balance`, con i null della vista già risolti. */
export interface ChoreBalance {
  userId: string
  displayName: string
  worksFromHome: boolean
  todayCount: number
  todayBonus: number
  todayCapacity: number
  netToday: number
  netBeforeToday: number
  netPosition: number
  tasksToParity: number
}

export interface NotchEntry {
  id: string
  name: string
}

export interface NotchHint {
  id: string
  name: string
}

export interface Notch {
  /** La tacca bonus di chi lavora da casa: è la più bassa e non entra nel confronto. */
  bonus: boolean
  entry: NotchEntry | null
  /** Un suggerimento dell'altra persona, sbiadito in una tacca ancora vuota. */
  hint: NotchHint | null
}

/**
 * Le tacche di una bottiglia dal basso verso l'alto. Le faccende arrivano
 * nell'ordine in cui sono state segnate e riempiono la tacca libera più
 * bassa: con il bonus, la prima faccenda del giorno finisce nella tacca bonus.
 *
 * I suggerimenti occupano le tacche vuote subito sopra le faccende, nell'ordine
 * in cui sono arrivati. Non sono faccende: quando se ne segna una, i
 * suggerimenti salgono di una tacca. Quelli che non ci stanno più li
 * restituisce `overflowHints`.
 */
export function bottleNotches(
  entries: NotchEntry[],
  capacity: number,
  bonus: number,
  hints: NotchHint[] = [],
): Notch[] {
  return Array.from({ length: capacity }, (_, i) => ({
    bonus: i < bonus,
    entry: entries[i] ?? null,
    hint: i < entries.length ? null : (hints[i - entries.length] ?? null),
  }))
}

/** I suggerimenti che non trovano una tacca libera (la bottiglia si è riempita dopo). */
export function overflowHints(entryCount: number, capacity: number, hints: NotchHint[]): NotchHint[] {
  return hints.slice(Math.max(capacity - entryCount, 0))
}

export function choresLabel(n: number): string {
  return `${n} ${n === 1 ? 'faccenda' : 'faccende'}`
}

export type ParityMessage =
  | { kind: 'pari'; title: string; details: string[] }
  | { kind: 'indietro'; mine: boolean; title: string; details: string[] }

/**
 * Il messaggio sotto le bottiglie, dal punto di vista di chi guarda: "Ti
 * manca…" a chi è indietro, "Ad Andrea manca…" all'altro. Non esiste un
 * "sei avanti": chi è avanti legge quello che manca all'altro, e basta.
 */
export function parityMessage(balances: ChoreBalance[], viewerId: string): ParityMessage {
  const behind = balances.find((b) => b.tasksToParity > 0)
  if (!behind) return { kind: 'pari', title: 'Siete pari', details: [] }

  const mine = behind.userId === viewerId
  const n = behind.tasksToParity
  const verb = n === 1 ? 'manca' : 'mancano'
  const title = mine
    ? `Ti ${verb} ${choresLabel(n)} per la parità`
    : `${toName(behind.displayName)} ${verb} ${choresLabel(n)} per la parità`

  const details: string[] = []

  const backlog = Math.min(Math.max(-behind.netBeforeToday, 0), n)
  if (backlog > 0) {
    details.push(
      backlog < n
        ? `Di cui ${backlog} dai giorni scorsi.`
        : n === 1
          ? 'Viene dai giorni scorsi.'
          : 'Vengono tutte dai giorni scorsi.',
    )
  }

  if (behind.todayBonus > 0 && behind.todayCount === 0) {
    details.push(
      mine
        ? 'La prima di oggi riempie la tua tacca bonus e non conta.'
        : `La prima di oggi riempie la tacca bonus di ${behind.displayName} e non conta.`,
    )
  }

  const room = Math.max(behind.todayCapacity - behind.todayCount, 0)
  if (room === 0) {
    details.push('La bottiglia di oggi è piena: il resto si recupera nei prossimi giorni.')
  } else if (room < n) {
    details.push(
      `Oggi c'è posto ${room === 1 ? 'per un’altra sola' : `per altre ${room}`}: il resto si recupera nei prossimi giorni.`,
    )
  }

  return { kind: 'indietro', mine, title, details }
}

/** «A Fede», «Ad Andrea»: la d eufonica davanti a vocale. */
function toName(name: string): string {
  return /^[aeiouàèéìòù]/i.test(name) ? `Ad ${name}` : `A ${name}`
}

/** Sposta un giorno YYYY-MM-DD di `delta` giorni, senza passare dal fuso orario. */
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
