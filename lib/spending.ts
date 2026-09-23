/** Aggregazioni di presentazione: il saldo ufficiale resta nella vista SQL. */
export interface SpendingItem { category: string; amount: number; my_contribution?: number }
export interface CategoryTotal { category: string; total: number; contribution: number; count: number }

export function categoryTotals(items: readonly SpendingItem[]): CategoryTotal[] {
  const groups = new Map<string, { amount: number; contribution: number; count: number }>()
  for (const item of items) {
    const group = groups.get(item.category) ?? { amount: 0, contribution: 0, count: 0 }
    group.amount += Math.round(item.amount * 100)
    group.contribution += Math.round((item.my_contribution ?? 0) * 100)
    group.count++
    groups.set(item.category, group)
  }
  return Array.from(groups, ([category, value]) => ({
    category, total: value.amount / 100, contribution: value.contribution / 100, count: value.count,
  })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

/** Anteprima della selezione: somma delle quote già calcolate dal database. */
export function selectionContribution(items: readonly SpendingItem[]): number {
  return items.reduce((sum, item) => sum + Math.round((item.my_contribution ?? 0) * 100), 0) / 100
}

/**
 * Categoria fittizia della fetta di coda dell'anello: non esiste nel database.
 * Vive qui, e non in lib/fmt.ts, perche' questo modulo resta senza import —
 * i test lo transpilano da solo (vedi tests/load-ts.mjs).
 */
export const RING_OTHER = '__altre__'

/**
 * Fette dell'anello. Le categorie sono 9, ma una palette categorica non regge
 * 9 tinte distinguibili — nemmeno per chi ha visione tricromatica piena — e
 * inventare hue sempre piu' vicini peggiora solo la lettura. Oltre le prime
 * `max` posizioni la coda confluisce in un'unica fetta grigia "Altre
 * categorie", che e' la convenzione dataviz per "Other".
 *
 * Il dettaglio completo per categoria resta intatto: le liste e i filtri
 * continuano a usare categoryTotals(), questa funzione serve solo al disegno.
 */
export function ringSegments(categories: readonly CategoryTotal[], max = 6): CategoryTotal[] {
  if (categories.length <= max) return [...categories]
  const tail = categories.slice(max - 1)
  const sum = (pick: (item: CategoryTotal) => number) =>
    tail.reduce((acc, item) => acc + Math.round(pick(item) * 100), 0) / 100
  return [
    ...categories.slice(0, max - 1),
    {
      category: RING_OTHER,
      total: sum((item) => item.total),
      contribution: sum((item) => item.contribution),
      count: tail.reduce((acc, item) => acc + item.count, 0),
    },
  ]
}

// ------------------------------------------------------------
// Effetto di una spesa sul saldo di chi guarda
// ------------------------------------------------------------
// Le quote arrivano da `v_expense_shares`: qui si fa solo la differenza fra
// quanto uno ha anticipato e la sua quota, in centesimi, come la vista del
// saldo. Nessuna regola di divisione ricalcolata lato client.

export interface ShareRow { expense_id: string | null; user_id: string | null; user_share: number | null }

/** Le quote di `userId`, per id della spesa. */
export function sharesOf(shares: readonly ShareRow[], userId: string): Map<string | null, number | null> {
  return new Map(shares.filter((s) => s.user_id === userId).map((s) => [s.expense_id, s.user_share]))
}

/** Anticipato meno quota: positivo se la spesa è a favore di `userId`. */
export function expenseContribution(expense: { amount: number; paid_by: string }, share: number, userId: string): number {
  const anticipated = expense.paid_by === userId ? expense.amount : 0
  return (Math.round(anticipated * 100) - Math.round(share * 100)) / 100
}

/**
 * Effetto sul saldo di `userId` di ogni spesa aperta, per id. Le saldate non
 * pesano più e restano fuori; resta fuori anche una spesa arrivata fra la
 * lettura delle spese e quella delle quote: la sua riga mostra solo lo stato,
 * fino al prossimo aggiornamento.
 */
export function contributionsById(
  expenses: readonly { id: string; amount: number; paid_by: string; settlement_id: string | null }[],
  shares: readonly ShareRow[],
  userId: string,
): Record<string, number> {
  const mine = sharesOf(shares, userId)
  const result: Record<string, number> = {}
  for (const expense of expenses) {
    if (expense.settlement_id !== null) continue
    const share = mine.get(expense.id)
    if (share != null) result[expense.id] = expenseContribution(expense, share, userId)
  }
  return result
}
