'use client'

import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { ExpenseRow } from '@/components/ExpenseRow'
import { SettlementRow } from '@/components/SettlementRow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatDate, formatEur, CATEGORY_LABELS, romeDateKey, todayISO } from '@/lib/fmt'
import { Constants } from '@/types/database'
import type { Tables } from '@/types/database'
import type { SettlementWithNames } from '@/lib/queries'

type Expense = Tables<'expenses'> & { paid_by_profile: { display_name: string } | null }
interface Props {
  expenses: Expense[]
  settlements: SettlementWithNames[]
  /** Effetto sul saldo di chi guarda, per id delle spese aperte. */
  contributions: Record<string, number>
  onAddExpense?: () => void
}

/** Una riga dello storico: una spesa o un conguaglio, al suo posto nel tempo. */
type Entry =
  | { kind: 'expense'; day: string; at: number; expense: Expense }
  | { kind: 'settlement'; day: string; at: number; settlement: SettlementWithNames }

export function SpeseFiltri({ expenses, settlements, contributions, onAddExpense }: Props) {
  const params = useSearchParams()
  const status = ['aperte', 'saldate'].includes(params.get('stato') ?? '') ? params.get('stato')! : 'tutte'
  const category = Constants.public.Enums.expense_category.find((c) => c === params.get('cat')) ?? 'tutte'
  // La ricerca ha uno stato suo: l'URL si aggiorna con replaceState, che il
  // router applica in una transizione, e un campo controllato da un valore
  // che arriva in ritardo perde lettere e fa saltare il cursore a fine riga.
  // L'URL resta la memoria dei filtri (ritorno dal dettaglio, link).
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const deferredQuery = useDeferredValue(query)
  const currentMonth = todayISO().slice(0, 7)
  const period = params.get('periodo')
  const legacyMonth = period === 'corrente' ? currentMonth : period === 'scorso'
    ? shiftMonth(currentMonth, -1) : ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('mese') ?? '') ? params.get('mese')! : legacyMonth
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('da') ?? '') ? params.get('da')! : ''
  const until = /^\d{4}-\d{2}-\d{2}$/.test(params.get('a') ?? '') ? params.get('a')! : ''
  // Le spese chiuse da un conguaglio: ci si arriva dalla sua riga o dal
  // dettaglio di una spesa saldata. Un id che non esiste non filtra niente.
  const settlementFilter = settlements.find((s) => s.id === params.get('conguaglio'))
  const hasFilter = status !== 'tutte' || category !== 'tutte' || Boolean(month || query || from || until || settlementFilter)
  function search(value: string) {
    setQuery(value)
    update('q', value, value)
  }
  function reset() {
    setQuery('')
    window.history.replaceState(null, '', '/spese')
  }
  function update(key: string, value: string, q = query) {
    const next = new URLSearchParams(params.toString())
    if (q) next.set('q', q)
    else next.delete('q')
    if (value && value !== 'tutte') next.set(key, value)
    else next.delete(key)
    if (key === 'mese') { next.delete('periodo'); next.delete('da'); next.delete('a') }
    const suffix = next.toString()
    window.history.replaceState(null, '', suffix ? '/spese?' + suffix : '/spese')
  }
  const needle = deferredQuery.trim().toLocaleLowerCase('it')
  const filtered = expenses.filter((e) =>
    (status === 'tutte' || (status === 'aperte' ? e.settlement_id === null : e.settlement_id !== null))
    && (category === 'tutte' || e.category === category)
    && (!month || e.expense_date.startsWith(month))
    && (!from || e.expense_date >= from) && (!until || e.expense_date <= until)
    && (!needle || e.description.toLocaleLowerCase('it').includes(needle))
    && (!settlementFilter || e.settlement_id === settlementFilter.id),
  )
  // I conguagli seguono gli stessi filtri dove hanno senso: nessuna categoria,
  // nessuna spesa aperta. Nella ricerca si trovano per nota, o scrivendo
  // «cong…» (da quattro lettere: «co» li mostrerebbe tutti cercando «Coop»).
  const visibleSettlements = settlements.filter((s) => {
    const day = romeDateKey(s.settled_at)
    return status !== 'aperte' && category === 'tutte'
      && (!settlementFilter || s.id === settlementFilter.id)
      && (!month || day.startsWith(month)) && (!from || day >= from) && (!until || day <= until)
      && (!needle || (s.notes ?? '').toLocaleLowerCase('it').includes(needle)
        || (needle.length >= 4 && 'conguaglio'.startsWith(needle)))
  })
  const closedCount = new Map<string, number>()
  for (const e of expenses) {
    if (e.settlement_id) closedCount.set(e.settlement_id, (closedCount.get(e.settlement_id) ?? 0) + 1)
  }
  // Dentro un giorno conta l'ora: le spese inserite prima di un conguaglio
  // stanno sotto la sua riga, quelle inserite dopo sopra.
  const entries: Entry[] = [
    ...filtered.map((expense): Entry => ({ kind: 'expense', day: expense.expense_date, at: Date.parse(expense.created_at), expense })),
    ...visibleSettlements.map((settlement): Entry => ({ kind: 'settlement', day: romeDateKey(settlement.settled_at), at: Date.parse(settlement.settled_at), settlement })),
  ].sort((a, b) => b.day.localeCompare(a.day) || b.at - a.at)
  const groups = new Map<string, Entry[]>()
  for (const entry of entries) {
    const day = groups.get(entry.day)
    if (day) day.push(entry)
    else groups.set(entry.day, [entry])
  }
  const total = filtered.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100
  // Il ritorno dal dettaglio usa la ricerca del campo, non quella dell'URL,
  // che può essere indietro di un tasto.
  const returnParams = new URLSearchParams(params.toString())
  if (query) returnParams.set('q', query)
  else returnParams.delete('q')
  const returnHref = '/spese' + (returnParams.toString() ? '?' + returnParams.toString() : '')

  return <div className="space-y-3 pb-24">
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="flex min-h-13 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-accent" aria-hidden />
        <span>Filtri e ricerca{hasFilter ? ' · attivi' : ''}</span><span className="ml-auto text-muted group-open:hidden">Apri</span><span className="ml-auto hidden text-muted group-open:inline">Chiudi</span>
      </summary>
      <div className="space-y-4 border-t border-border p-4 sm:p-5">
      {(from || until) && <p className="text-sm text-muted">Periodo dalle statistiche: {from ? formatDate(from) : "inizio storico"} – {until ? formatDate(until) : "oggi"}. Scegli un mese per cambiarlo.</p>}
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
          <input type="search" aria-label="Cerca una spesa" placeholder="Cerca una spesa…" value={query} onChange={(e) => search(e.target.value)} className="h-12 w-full rounded-2xl bg-surface-raised pr-12 pl-10 text-base" />
          {query && <button aria-label="Cancella ricerca" type="button" onClick={() => search('')} className="absolute top-0.5 right-1 flex size-11 items-center justify-center rounded-full"><X className="size-4" aria-hidden /></button>}
        </div>
        <select aria-label="Categoria" value={category} onChange={(e) => update('cat', e.target.value)} className="min-h-12 min-w-0 rounded-2xl border border-border bg-surface px-3 text-base">
          <option value="tutte">Tutte le categorie</option>{Constants.public.Enums.expense_category.map((cat) => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
        </select>
      </div>
      </div>
    </details>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm" aria-live="polite">
      <p className="text-muted">{filtered.length} {filtered.length === 1 ? 'spesa' : 'spese'} · <span className="font-semibold tabular-nums text-foreground">{formatEur(total)}</span> totali</p>
      {hasFilter && <Button variant="ghost" size="sm" onClick={reset}>Azzera filtri</Button>}
      {settlementFilter && <p className="w-full text-muted">Spese chiuse dal conguaglio del {formatDate(settlementFilter.settled_at)}.</p>}
    </div>
    {entries.length === 0 ? <Card className="px-5 py-10 text-center"><p className="font-display text-2xl font-semibold">{expenses.length ? 'Nessuna corrispondenza' : 'La prima spesa, insieme.'}</p><p className="mt-3 text-sm text-muted">{expenses.length ? 'Prova un altro periodo o una categoria diversa.' : 'Aggiungi una spesa per iniziare a tenere i conti.'}</p>
      {!expenses.length && onAddExpense && <Button className="mt-5" onClick={onAddExpense}>Aggiungi spesa</Button>}</Card>
      : Array.from(groups, ([date, items]) => {
        const dayExpenses = items.flatMap((item) => item.kind === 'expense' ? [item.expense] : [])
        return <section key={date}>
          <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 mb-2 flex justify-between gap-3 bg-background/95 px-1 py-3 text-xs font-semibold backdrop-blur-md">
            <h2>{formatDate(date)}</h2>{dayExpenses.length > 0 && <span className="tabular-nums">{formatEur(dayExpenses.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100)}</span>}
          </div>
          <div className="space-y-2">{segments(items).map((segment) => segment.kind === 'settlement'
            ? <SettlementRow key={segment.settlement.id} settlement={segment.settlement} expenseCount={closedCount.get(segment.settlement.id) ?? 0}
              href={settlementFilter ? undefined : '/spese?conguaglio=' + segment.settlement.id} />
            : <Card key={segment.expenses[0].id} className="divide-y divide-border overflow-hidden">{segment.expenses.map((e) =>
              <ExpenseRow key={e.id} expense={e} returnHref={returnHref} contribution={contributions[e.id]} />)}</Card>)}
          </div>
        </section>
      })}
  </div>
}

/**
 * Le spese consecutive dello stesso giorno restano in una card sola; un
 * conguaglio la spezza e sta da solo, fra le spese che ha chiuso (sotto) e
 * quelle arrivate dopo (sopra).
 */
function segments(items: Entry[]) {
  const result: ({ kind: 'expenses'; expenses: Expense[] } | { kind: 'settlement'; settlement: SettlementWithNames })[] = []
  for (const item of items) {
    const last = result[result.length - 1]
    if (item.kind === 'settlement') result.push({ kind: 'settlement', settlement: item.settlement })
    else if (last?.kind === 'expenses') last.expenses.push(item.expense)
    else result.push({ kind: 'expenses', expenses: [item.expense] })
  }
  return result
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}
