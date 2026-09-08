'use client'

import { useSearchParams } from 'next/navigation'
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { ExpenseRow } from '@/components/ExpenseRow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatDate, formatEur, CATEGORY_LABELS, todayISO } from '@/lib/fmt'
import { Constants } from '@/types/database'
import type { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & { paid_by_profile: { display_name: string } | null }
interface Props { expenses: Expense[]; onAddExpense?: () => void }

export function SpeseFiltri({ expenses, onAddExpense }: Props) {
  const params = useSearchParams()
  const status = ['aperte', 'saldate'].includes(params.get('stato') ?? '') ? params.get('stato')! : 'tutte'
  const category = Constants.public.Enums.expense_category.find((c) => c === params.get('cat')) ?? 'tutte'
  const query = params.get('q') ?? ''
  const currentMonth = todayISO().slice(0, 7)
  const period = params.get('periodo')
  const legacyMonth = period === 'corrente' ? currentMonth : period === 'scorso'
    ? shiftMonth(currentMonth, -1) : ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('mese') ?? '') ? params.get('mese')! : legacyMonth
  const hasFilter = status !== 'tutte' || category !== 'tutte' || Boolean(month || query)
  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== 'tutte') next.set(key, value)
    else next.delete(key)
    if (key === 'mese') next.delete('periodo')
    const suffix = next.toString()
    window.history.replaceState(null, '', suffix ? '/spese?' + suffix : '/spese')
  }
  const filtered = expenses.filter((e) =>
    (status === 'tutte' || (status === 'aperte' ? e.settlement_id === null : e.settlement_id !== null))
    && (category === 'tutte' || e.category === category)
    && (!month || e.expense_date.startsWith(month))
    && (!query.trim() || e.description.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))),
  )
  const groups = new Map<string, Expense[]>()
  for (const expense of filtered) groups.set(expense.expense_date, [...(groups.get(expense.expense_date) ?? []), expense])
  const total = filtered.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100
  const returnHref = '/spese' + (params.toString() ? '?' + params.toString() : '')

  return <div className="space-y-3 pb-24">
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-13 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-accent" aria-hidden />
        <span>Filtri e ricerca{hasFilter ? ' · attivi' : ''}</span><span className="ml-auto text-muted group-open:hidden">Apri</span><span className="ml-auto hidden text-muted group-open:inline">Chiudi</span>
      </summary>
      <div className="space-y-4 border-t border-border p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Mese precedente" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-raised" onClick={() => update('mese', shiftMonth(month || currentMonth, -1))}><ChevronLeft className="size-5" aria-hidden /></button>
        <div className="min-w-0 flex-1"><label htmlFor="history-month" className="mb-1 block text-xs text-muted">Periodo</label>
          <input id="history-month" type="month" value={month} onChange={(e) => update('mese', e.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-surface px-3 text-base" /></div>
        <button type="button" aria-label="Mese successivo" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-raised" onClick={() => update('mese', shiftMonth(month || currentMonth, 1))}><ChevronRight className="size-5" aria-hidden /></button>
      </div>
      <div className="flex gap-2"><Button size="sm" variant={month === currentMonth ? 'secondary' : 'ghost'} onClick={() => update('mese', currentMonth)}>Questo mese</Button><Button size="sm" variant={!month ? 'secondary' : 'ghost'} onClick={() => update('mese', '')}>Tutto lo storico</Button></div>
      <SegmentedControl groupId="history-status" label="Stato delle spese" value={status} onChange={(v) => update('stato', v)}
        options={[{ value: 'tutte', label: 'Tutte' }, { value: 'aperte', label: 'Aperte' }, { value: 'saldate', label: 'Saldate' }]} />
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" aria-label="Cerca una spesa" placeholder="Cerca una spesa…" value={query} onChange={(e) => update('q', e.target.value)} className="h-12 w-full rounded-2xl bg-surface-raised pr-12 pl-10 text-base" />
          {query && <button aria-label="Cancella ricerca" type="button" onClick={() => update('q', '')} className="absolute top-0.5 right-1 flex size-11 items-center justify-center rounded-full"><X className="size-4" aria-hidden /></button>}
        </div>
        <select aria-label="Categoria" value={category} onChange={(e) => update('cat', e.target.value)} className="min-h-12 min-w-0 rounded-2xl border border-border bg-surface px-3 text-base">
          <option value="tutte">Tutte le categorie</option>{Constants.public.Enums.expense_category.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
        </select>
      </div>
      </div>
    </details>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm" aria-live="polite">
      <p className="text-muted">{filtered.length} movimenti · <span className="font-semibold tabular-nums text-foreground">{formatEur(total)}</span> totali</p>
      {hasFilter && <Button variant="ghost" size="sm" onClick={() => window.history.replaceState(null, '', '/spese')}>Azzera filtri</Button>}
    </div>
    {filtered.length === 0 ? <Card className="px-5 py-10 text-center"><p className="font-display text-2xl font-semibold">{expenses.length ? 'Nessuna corrispondenza' : 'La prima spesa, insieme.'}</p><p className="mt-3 text-sm text-muted">{expenses.length ? 'Prova un altro periodo o una categoria diversa.' : 'Aggiungi una spesa per iniziare a tenere i conti.'}</p>
      {!expenses.length && onAddExpense && <Button className="mt-5" onClick={onAddExpense}>Aggiungi spesa</Button>}</Card>
      : Array.from(groups, ([date, items]) => <section key={date}>
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 mb-2 flex justify-between gap-3 bg-background/95 px-1 py-3 text-xs font-semibold backdrop-blur-md">
          <h2>{formatDate(date)}</h2><span className="tabular-nums">{formatEur(items.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100)}</span>
        </div>
        <Card className="divide-y divide-border overflow-hidden">{items.map((e) => <ExpenseRow key={e.id} expense={e} returnHref={returnHref} />)}</Card>
      </section>)}
  </div>
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
