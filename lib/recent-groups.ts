/**
 * Gruppi delle ultime spese in home, per quanto sono lontane da oggi. Finestre
 * mobili, non settimane di calendario: «Ultimi tre giorni» è oggi, ieri e
 * l'altro ieri; «Ultima settimana» da 3 a 6 giorni fa; «Settimana scorsa» da
 * 7 a 13; il resto è «Più vecchie». Così il primo gruppo non resta mai vuoto
 * di lunedì e i gruppi non cambiano significato a seconda del giorno.
 *
 * Il confronto è tra chiavi YYYY-MM-DD, con `today` nel fuso della casa
 * (`todayISO()` in `lib/fmt.ts`), come per le spese future. Solo
 * presentazione: le spese arrivano già dalla più recente e restano in
 * quell'ordine dentro ogni gruppo.
 */
export const RECENT_GROUPS = [
  { key: 'tre-giorni', label: 'Ultimi tre giorni', maxDays: 2 },
  { key: 'settimana', label: 'Ultima settimana', maxDays: 6 },
  { key: 'settimana-scorsa', label: 'Settimana scorsa', maxDays: 13 },
  { key: 'vecchie', label: 'Più vecchie', maxDays: Infinity },
] as const

export type RecentGroupKey = (typeof RECENT_GROUPS)[number]['key']

/** Giorni interi tra due chiavi YYYY-MM-DD (positivo se `date` è prima di `today`). */
export function daysAgo(date: string, today: string): number {
  const utc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
  return Math.round((utc(today) - utc(date)) / 86_400_000)
}

/** Divide le spese nei gruppi, saltando quelli vuoti. Una data futura cade nel primo. */
export function groupRecent<T extends { expense_date: string }>(
  expenses: T[],
  today: string,
): { key: RecentGroupKey; label: string; expenses: T[] }[] {
  const groups = RECENT_GROUPS.map(({ key, label }) => ({ key, label, expenses: [] as T[] }))
  for (const expense of expenses) {
    const days = daysAgo(expense.expense_date, today)
    groups[RECENT_GROUPS.findIndex((g) => days <= g.maxDays)].expenses.push(expense)
  }
  return groups.filter((g) => g.expenses.length > 0)
}
