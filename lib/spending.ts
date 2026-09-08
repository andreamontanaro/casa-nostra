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
