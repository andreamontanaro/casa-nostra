export type Period = 'month' | '3months' | 'year' | 'all'
/** Dates are UTC containers for calendar days in Europe/Rome; end is exclusive. */
export interface DateRange { start: Date | null; end: Date }
function calendarDay(now: Date) {
  return new Date(now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) + 'T00:00:00Z')
}
function monthStart(day: Date, offset = 0) { return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + offset, 1)) }
function nextDay(day: Date) { return new Date(day.getTime() + 86400000) }
function equivalentDay(day: Date, offset: number) {
  const month = monthStart(day, offset)
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(day.getUTCDate(), last)))
}
export function getPeriodRange(period: Period, now = new Date()): DateRange {
  const day = calendarDay(now)
  const start = period === 'all' ? null : period === 'year' ? new Date(Date.UTC(day.getUTCFullYear(), 0, 1)) : monthStart(day, period === '3months' ? -2 : 0)
  return { start, end: nextDay(day) }
}
export function getPreviousPeriodRange(period: Period, now = new Date()): DateRange | null {
  if (period === 'all') return null
  const day = calendarDay(now)
  const previousDay = equivalentDay(day, period === 'year' ? -12 : period === '3months' ? -3 : -1)
  const start = period === 'year' ? new Date(Date.UTC(previousDay.getUTCFullYear(), 0, 1)) : monthStart(previousDay, period === '3months' ? -2 : 0)
  return { start, end: nextDay(previousDay) }
}
export function inRange(dateStr: string, range: DateRange) {
  const d = dateStr.includes('T') ? calendarDay(new Date(dateStr)) : new Date(dateStr + 'T00:00:00Z')
  return Number.isFinite(d.getTime()) && (!range.start || d >= range.start) && d < range.end
}
export function rangeLabel(range: DateRange) {
  const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const end = fmt.format(new Date(range.end.getTime() - 86400000))
  return range.start ? fmt.format(range.start) + ' – ' + end : 'Fino al ' + end
}
export function historyRangeQuery(range: DateRange) {
  const query = new URLSearchParams()
  if (range.start) query.set('da', range.start.toISOString().slice(0, 10))
  query.set('a', new Date(range.end.getTime() - 86400000).toISOString().slice(0, 10))
  return query
}
export interface MonthBucket { monthKey: string; label: string; year: number; total: number; count: number }
export function groupExpensesByMonth<T extends { expense_date: string; amount: number }>(expenses: T[], monthsBack = 12, now = new Date()): MonthBucket[] {
  const day = calendarDay(now)
  const fmt = new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' })
  const buckets = Array.from({ length: monthsBack }, (_, i) => {
    const date = monthStart(day, i - monthsBack + 1)
    return { monthKey: date.toISOString().slice(0, 7), label: fmt.format(date).replace('.', ''), year: date.getUTCFullYear(), total: 0, count: 0 }
  })
  for (const e of expenses) {
    const bucket = buckets.find((b) => b.monthKey === e.expense_date.slice(0, 7))
    if (!bucket) continue
    bucket.total = (Math.round(bucket.total * 100) + Math.round(e.amount * 100)) / 100
    bucket.count++
  }
  return buckets
}
export interface CategoryBucket { category: string; total: number; count: number }
export function groupExpensesByCategory<T extends { category: string; amount: number }>(expenses: T[]): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>()
  for (const e of expenses) {
    const item = map.get(e.category) ?? { category: e.category, total: 0, count: 0 }
    item.total = (Math.round(item.total * 100) + Math.round(e.amount * 100)) / 100
    item.count++
    map.set(e.category, item)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
export function sumAmounts<T extends { amount: number }>(items: T[]) { return items.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100 }
export function deltaPercent(current: number, previous: number): number | null { return previous === 0 ? (current === 0 ? 0 : null) : (current - previous) / previous * 100 }
