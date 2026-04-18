'use client'

import { useState, useMemo } from 'react'
import { ExpenseRow } from '@/components/ExpenseRow'
import { Card } from '@/components/ui/Card'
import { formatDate, CATEGORY_LABELS } from '@/lib/fmt'
import { Tables, Constants } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}

type StatusFilter = 'tutte' | 'aperte' | 'saldate'

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

export function SpeseFiltri({ expenses }: SpeseFiltriProps) {
  const [status, setStatus] = useState<StatusFilter>('tutte')
  const [category, setCategory] = useState<string>('tutte')
  const [month, setMonth] = useState<string>('tutti')

  const months = useMemo(() => {
    const set = new Set<string>()
    for (const e of expenses) set.add(e.expense_date.slice(0, 7))
    return Array.from(set).sort().reverse()
  }, [expenses])

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (status === 'aperte' && e.settlement_id !== null) return false
      if (status === 'saldate' && e.settlement_id === null) return false
      if (category !== 'tutte' && e.category !== category) return false
      if (month !== 'tutti' && !e.expense_date.startsWith(month)) return false
      return true
    })
  }, [expenses, status, category, month])

  const grouped = groupByDate(filtered)

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro mese */}
      {months.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Chip active={month === 'tutti'} onClick={() => setMonth('tutti')}>Tutti</Chip>
          {months.map((m) => (
            <Chip key={m} active={month === m} onClick={() => setMonth(m)}>
              {new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(m + '-01'))}
            </Chip>
          ))}
        </div>
      )}

      {/* Filtro stato */}
      <div className="flex gap-2">
        {(['tutte', 'aperte', 'saldate'] as StatusFilter[]).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </div>

      {/* Filtro categoria */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Chip active={category === 'tutte'} onClick={() => setCategory('tutte')}>Tutte</Chip>
        {Constants.public.Enums.expense_category.map((cat) => (
          <Chip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </Chip>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nessuna spesa trovata.</p>
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
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-accent bg-accent-muted text-accent'
          : 'border-border bg-surface text-muted hover:border-accent/50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
