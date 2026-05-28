export type Period = 'month' | '3months' | 'year' | 'all'

export interface DateRange {
  start: Date | null
  end: Date
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function endOfDayExclusive(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(x.getDate() + 1)
  return x
}

export function getPeriodRange(period: Period, now: Date = new Date()): DateRange {
  const end = endOfDayExclusive(now)
  switch (period) {
    case 'month':
      return { start: startOfMonth(now), end }
    case '3months':
      return { start: addMonths(startOfMonth(now), -2), end }
    case 'year':
      return { start: startOfYear(now), end }
    case 'all':
      return { start: null, end }
  }
}

export function getPreviousPeriodRange(
  period: Period,
  now: Date = new Date(),
): DateRange | null {
  if (period === 'all') return null
  switch (period) {
    case 'month': {
      const start = addMonths(startOfMonth(now), -1)
      const end = startOfMonth(now)
      return { start, end }
    }
    case '3months': {
      const start = addMonths(startOfMonth(now), -5)
      const end = addMonths(startOfMonth(now), -2)
      return { start, end }
    }
    case 'year': {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = startOfYear(now)
      return { start, end }
    }
  }
}

export function inRange(dateStr: string, range: DateRange): boolean {
  const d = new Date(dateStr)
  if (range.start && d < range.start) return false
  if (d >= range.end) return false
  return true
}

export interface MonthBucket {
  monthKey: string // YYYY-MM
  label: string // 'mag' (3-letter month, italian)
  year: number
  total: number
  count: number
}

const MONTH_SHORT = new Intl.DateTimeFormat('it-IT', { month: 'short' })

export function groupExpensesByMonth<T extends { expense_date: string; amount: number }>(
  expenses: T[],
  monthsBack: number = 12,
  now: Date = new Date(),
): MonthBucket[] {
  const buckets: MonthBucket[] = []
  const start = addMonths(startOfMonth(now), -(monthsBack - 1))
  for (let i = 0; i < monthsBack; i++) {
    const d = addMonths(start, i)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push({
      monthKey,
      label: MONTH_SHORT.format(d).replace('.', ''),
      year: d.getFullYear(),
      total: 0,
      count: 0,
    })
  }
  const byKey = new Map(buckets.map((b) => [b.monthKey, b]))
  for (const e of expenses) {
    const key = e.expense_date.slice(0, 7)
    const bucket = byKey.get(key)
    if (!bucket) continue
    bucket.total += Number(e.amount)
    bucket.count += 1
  }
  return buckets
}

export interface CategoryBucket {
  category: string
  total: number
  count: number
}

export function groupExpensesByCategory<
  T extends { category: string; amount: number },
>(expenses: T[]): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>()
  for (const e of expenses) {
    const cur = map.get(e.category) ?? { category: e.category, total: 0, count: 0 }
    cur.total += Number(e.amount)
    cur.count += 1
    map.set(e.category, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function sumAmounts<T extends { amount: number }>(items: T[]): number {
  return items.reduce((acc, x) => acc + Number(x.amount), 0)
}

export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}
