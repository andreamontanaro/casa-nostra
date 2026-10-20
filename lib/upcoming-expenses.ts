/**
 * Spese future: quelle datate dopo oggi. Di solito sono bollette inserite
 * appena se ne conosce l'importo, ma con la data del giorno di addebito.
 * Home e storico le mostrano in una sezione loro, in cima e separate dalle
 * spese già avvenute; oggi non è futuro.
 *
 * Il confronto è tra chiavi YYYY-MM-DD, con `today` nel fuso della casa
 * (`todayISO()` in `lib/fmt.ts`). Solo presentazione: nel saldo e nel
 * conguaglio una spesa futura aperta pesa come le altre.
 */
export function isUpcoming(expenseDate: string, today: string): boolean {
  return expenseDate > today
}

/**
 * Divide le spese in future, dalla più vicina, e passate, nell'ordine in cui
 * sono arrivate (lo storico le legge dalla più recente).
 */
export function splitUpcoming<T extends { expense_date: string; created_at: string }>(
  expenses: T[],
  today: string,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = []
  const past: T[] = []
  for (const expense of expenses) {
    if (isUpcoming(expense.expense_date, today)) upcoming.push(expense)
    else past.push(expense)
  }
  upcoming.sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.created_at.localeCompare(b.created_at))
  return { upcoming, past }
}
