'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Search, X } from 'lucide-react'
import { ExpenseRow } from '@/components/ExpenseRow'
import { Card } from '@/components/ui/Card'
import { formatDate, formatEur, CATEGORY_LABELS } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'
import { cn } from '@/lib/utils'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}

type StatusFilter = 'tutte' | 'aperte' | 'saldate'
type RangePreset = 'corrente' | 'scorso' | 'tutti'

interface SpeseFiltriProps {
  expenses: Expense[]
}

function groupByDate(expenses: Expense[]): Map<string, Expense[]> {
  const map = new Map<string, Expense[]>()
  for (const e of expenses) {
    const key = e.expense_date
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return map
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthKey(): string {
  return monthKey(new Date())
}

function previousMonthKey(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return monthKey(d)
}

export function SpeseFiltri({ expenses }: SpeseFiltriProps) {
  const [status, setStatus] = useState<StatusFilter>('tutte')
  const [category, setCategory] = useState<string>('tutte')
  const [range, setRange] = useState<RangePreset>('tutti')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const curMonth = currentMonthKey()
    const prevMonth = previousMonthKey()

    return expenses.filter((e) => {
      if (status === 'aperte' && e.settlement_id !== null) return false
      if (status === 'saldate' && e.settlement_id === null) return false
      if (category !== 'tutte' && e.category !== category) return false

      if (range !== 'tutti') {
        const m = e.expense_date.slice(0, 7)
        if (range === 'corrente' && m !== curMonth) return false
        if (range === 'scorso' && m !== prevMonth) return false
      }

      if (q && !e.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [expenses, status, category, range, query])

  const summary = useMemo(() => {
    const total = filtered.reduce((acc, e) => acc + Number(e.amount), 0)
    return { count: filtered.length, total }
  }, [filtered])

  const grouped = groupByDate(filtered)
  const hasAnyFilter =
    status !== 'tutte' ||
    category !== 'tutte' ||
    range !== 'tutti' ||
    query.length > 0

  return (
    <div className="flex flex-col gap-4">
      {/* Ricerca */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={2}
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per descrizione…"
          className={cn(
            'h-11 w-full rounded-2xl border border-border bg-surface',
            // text-base (16px): sotto i 16px iOS Safari fa zoom sulla UI al focus.
            'pl-10 pr-10 text-base text-foreground placeholder:text-muted',
            'shadow-soft',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Cancella ricerca"
            className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Stato (tabs animati) */}
      <SegmentedControl
        groupId="spese-status"
        value={status}
        onChange={(v) => setStatus(v as StatusFilter)}
        options={[
          { value: 'tutte', label: 'Tutte' },
          { value: 'aperte', label: 'Aperte' },
          { value: 'saldate', label: 'Saldate' },
        ]}
      />

      {/* Periodo (preset) */}
      <SegmentedControl
        groupId="spese-range"
        value={range}
        onChange={(v) => setRange(v as RangePreset)}
        options={[
          { value: 'corrente', label: 'Mese' },
          { value: 'scorso', label: 'Scorso' },
          { value: 'tutti', label: 'Tutti' },
        ]}
      />

      {/* Categoria (chip scroll orizzontale) */}
      <div
        className="-mx-4 overflow-x-auto no-scrollbar"
        style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
      >
        <div className="flex gap-2 px-4">
          <Chip
            active={category === 'tutte'}
            onClick={() => setCategory('tutte')}
          >
            Tutte
          </Chip>
          {Constants.public.Enums.expense_category.map((cat) => (
            <Chip
              key={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </Chip>
          ))}
        </div>
      </div>

      {/* Card riepilogo */}
      {hasAnyFilter && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'flex items-center justify-between rounded-2xl border border-border bg-surface-raised px-4 py-2.5',
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {summary.count}
            </span>
            <span className="text-xs text-muted">
              {summary.count === 1 ? 'spesa' : 'spese'}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatEur(summary.total)}
          </span>
        </motion.div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised text-2xl">
            🗒️
          </div>
          <p className="text-sm font-medium text-foreground">
            Nessuna spesa trovata
          </p>
          <p className="text-xs text-muted">
            Prova a cambiare i filtri o aggiungine una nuova.
          </p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([date, items]) => (
          <div key={date}>
            <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {formatDate(date)}
            </p>
            <Card className="divide-y divide-border overflow-hidden p-0">
              {items.map((e) => (
                <ExpenseRow key={e.id} expense={e} />
              ))}
            </Card>
          </div>
        ))
      )}
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Filter chip M3: 8dp, selezionato = container tonale senza outline
        'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium',
        'transition-[border-color,background-color,color,transform] duration-150',
        'active:scale-[0.97]',
        active
          ? 'border-transparent bg-accent-muted text-accent-soft'
          : 'border-border-strong bg-transparent text-muted hover:border-accent/40',
      )}
    >
      {children}
    </button>
  )
}
