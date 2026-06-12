'use client'

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import {
  CATEGORY_ICON,
  CATEGORY_LABELS,
  formatDate,
  formatEur,
} from '@/lib/fmt'
import { cn } from '@/lib/utils'
import { Tables } from '@/types/database'
import {
  Period,
  deltaPercent,
  getPeriodRange,
  getPreviousPeriodRange,
  groupExpensesByCategory,
  groupExpensesByMonth,
  inRange,
  sumAmounts,
} from './period'

type Expense = Tables<'expenses'>
type Settlement = Tables<'settlements'> & {
  from_user: { display_name: string } | null
  to_user: { display_name: string } | null
}

interface StatisticheClientProps {
  expenses: Expense[]
  settlements: Settlement[]
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'Mese' },
  { value: '3months', label: '3 mesi' },
  { value: 'year', label: 'Anno' },
  { value: 'all', label: 'Tutto' },
]

const PERIOD_LABEL_LONG: Record<Period, string> = {
  month: 'in questo mese',
  '3months': 'negli ultimi 3 mesi',
  year: 'in questo anno',
  all: 'da sempre',
}

// Colori categorie (coerenti con CATEGORY_COLOR ma in formato hex per Recharts)
const CATEGORY_HEX: Record<string, string> = {
  affitto: '#3b82f6',
  bolletta: '#eab308',
  spesa_alimentare: '#22c55e',
  abbonamento: '#a855f7',
  manutenzione: '#f97316',
  viaggi: '#0ea5e9',
  altro: '#71717a',
}

export function StatisticheClient({
  expenses,
  settlements,
}: StatisticheClientProps) {
  const [period, setPeriod] = useState<Period>('3months')

  const now = useMemo(() => new Date(), [])
  const range = useMemo(() => getPeriodRange(period, now), [period, now])
  const prevRange = useMemo(
    () => getPreviousPeriodRange(period, now),
    [period, now],
  )

  const periodExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.expense_date, range)),
    [expenses, range],
  )
  const periodSettlements = useMemo(
    () => settlements.filter((s) => inRange(s.settled_at, range)),
    [settlements, range],
  )

  const totalCurrent = useMemo(
    () => sumAmounts(periodExpenses),
    [periodExpenses],
  )
  const totalPrevious = useMemo(() => {
    if (!prevRange) return null
    return sumAmounts(expenses.filter((e) => inRange(e.expense_date, prevRange)))
  }, [expenses, prevRange])
  const delta = useMemo(
    () => (totalPrevious === null ? null : deltaPercent(totalCurrent, totalPrevious)),
    [totalCurrent, totalPrevious],
  )

  const monthlyBuckets = useMemo(
    () => groupExpensesByMonth(expenses, 12, now),
    [expenses, now],
  )
  const monthlyMax = useMemo(
    () => Math.max(0, ...monthlyBuckets.map((b) => b.total)),
    [monthlyBuckets],
  )

  const categoryBuckets = useMemo(
    () => groupExpensesByCategory(periodExpenses),
    [periodExpenses],
  )

  const settlementStats = useMemo(() => {
    const count = periodSettlements.length
    const total = sumAmounts(periodSettlements)
    const avg = count > 0 ? total / count : 0
    const last = periodSettlements[0] ?? null
    return { count, total, avg, last }
  }, [periodSettlements])

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Statistiche</h1>

      <SegmentedControl
        groupId="stats-period"
        value={period}
        onChange={(v) => setPeriod(v as Period)}
        options={PERIOD_OPTIONS}
      />

      {/* Volume del periodo */}
      <Card>
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Spesa {PERIOD_LABEL_LONG[period]}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-3">
            <motion.p
              key={`${period}-${totalCurrent}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-3xl font-bold tracking-tight tabular-nums text-foreground"
            >
              {formatEur(totalCurrent)}
            </motion.p>
            <DeltaBadge delta={delta} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {periodExpenses.length}{' '}
            {periodExpenses.length === 1 ? 'spesa' : 'spese'} registrate
          </p>
        </CardContent>
      </Card>

      {/* Andamento ultimi 12 mesi */}
      <Card>
        <CardHeader className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">Ultimi 12 mesi</p>
          <p className="text-xs text-muted">Totale per mese</p>
        </CardHeader>
        <CardContent>
          {monthlyMax === 0 ? (
            <EmptyState>Nessuna spesa negli ultimi 12 mesi.</EmptyState>
          ) : (
            <div className="-mx-2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyBuckets}
                  margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                  barCategoryGap="22%"
                >
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-raised)', opacity: 0.6 }}
                    content={<MonthTooltip />}
                  />
                  <Bar dataKey="total" radius={[6, 6, 2, 2]}>
                    {monthlyBuckets.map((b, i) => (
                      <Cell
                        key={b.monthKey}
                        fill={
                          i === monthlyBuckets.length - 1
                            ? 'var(--accent)'
                            : 'var(--accent-soft)'
                        }
                        fillOpacity={i === monthlyBuckets.length - 1 ? 1 : 0.55}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per categoria */}
      <Card>
        <CardHeader className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">Per categoria</p>
          <p className="text-xs text-muted">{PERIOD_LABEL_LONG[period]}</p>
        </CardHeader>
        <CardContent>
          {categoryBuckets.length === 0 ? (
            <EmptyState>Nessuna spesa nel periodo selezionato.</EmptyState>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBuckets}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    >
                      {categoryBuckets.map((b) => (
                        <Cell
                          key={b.category}
                          fill={CATEGORY_HEX[b.category] ?? '#71717a'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<CategoryTooltip total={totalCurrent} />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 flex flex-col gap-2.5">
                {categoryBuckets.map((b) => {
                  const pct = totalCurrent > 0 ? (b.total / totalCurrent) * 100 : 0
                  const color = CATEGORY_HEX[b.category] ?? '#71717a'
                  return (
                    <li key={b.category} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="text-base leading-none">
                            {CATEGORY_ICON[b.category] ?? '📦'}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">
                            {CATEGORY_LABELS[b.category] ?? b.category}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {formatEur(b.total)}
                          </span>
                          <span className="text-xs tabular-nums text-muted">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* Conguagli */}
      <Card>
        <CardHeader className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-foreground">Conguagli</p>
          <p className="text-xs text-muted">{PERIOD_LABEL_LONG[period]}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-surface-raised p-3 text-center">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                Numero
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {settlementStats.count}
              </p>
            </div>
            <div className="border-x border-border">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                Importo medio
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {settlementStats.count > 0 ? formatEur(settlementStats.avg) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
                Totale
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                {settlementStats.count > 0
                  ? formatEur(settlementStats.total)
                  : '—'}
              </p>
            </div>
          </div>

          {periodSettlements.length === 0 ? (
            <EmptyState className="mt-4">
              Nessun conguaglio in questo periodo.
            </EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {periodSettlements.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-1"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span className="truncate">
                        {s.from_user?.display_name ?? '—'}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted" />
                      <span className="truncate">
                        {s.to_user?.display_name ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {formatDate(s.settled_at)}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatEur(Number(s.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isUp = delta > 0.5
  const isDown = delta < -0.5
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus
  // Per le spese: "su" è negativo (rosso), "giù" è positivo (verde)
  const tone = isUp
    ? 'bg-destructive/10 text-destructive'
    : isDown
      ? 'bg-accent-muted text-accent-soft'
      : 'bg-surface-raised text-muted'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        tone,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {Math.abs(delta).toFixed(0)}%
    </span>
  )
}

function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('py-6 text-center text-sm text-muted', className)}>
      {children}
    </p>
  )
}

interface TooltipPayloadEntry {
  value?: number
  payload?: { monthKey?: string; year?: number; label?: string; category?: string }
}

function MonthTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const value = Number(item.value ?? 0)
  const label = item.payload?.label ?? ''
  const year = item.payload?.year
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">
        {label}
        {year ? ` ${year}` : ''}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums text-accent">
        {formatEur(value)}
      </p>
    </div>
  )
}

function CategoryTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  total: number
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const value = Number(item.value ?? 0)
  const cat = item.payload?.category ?? ''
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">
        {CATEGORY_ICON[cat] ?? '📦'} {CATEGORY_LABELS[cat] ?? cat}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums text-foreground">
        {formatEur(value)}{' '}
        <span className="font-normal text-muted">· {pct.toFixed(0)}%</span>
      </p>
    </div>
  )
}

function SegmentedControl({
  groupId,
  value,
  onChange,
  options,
}: {
  groupId: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="relative flex rounded-2xl border border-border bg-surface-raised p-1">
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-xl px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-150',
              isActive ? 'text-foreground' : 'text-muted',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`segctl-${groupId}`}
                transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-soft"
              />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
