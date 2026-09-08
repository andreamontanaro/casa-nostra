'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CategoryIcon } from '@/components/CategoryIcon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatDate, formatEur, CATEGORY_LABELS, categoryHex } from '@/lib/fmt'
import { useDarkTheme } from '@/lib/use-dark-theme'
import type { Tables } from '@/types/database'
import { type Period, deltaPercent, getPeriodRange, getPreviousPeriodRange, groupExpensesByCategory, groupExpensesByMonth, inRange, sumAmounts, rangeLabel, historyRangeQuery } from './period'

type Settlement = Tables<'settlements'> & { from_user: { display_name: string } | null; to_user: { display_name: string } | null }
export function StatisticheClient({ expenses, settlements }: { expenses: Tables<'expenses'>[]; settlements: Settlement[] }) {
  const [period, setPeriod] = useState<Period>('3months')
  const now = useMemo(() => new Date(), [])
  const dark = useDarkTheme()
  const range = getPeriodRange(period, now)
  const previous = getPreviousPeriodRange(period, now)
  const filtered = expenses.filter((e) => inRange(e.expense_date, range))
  const total = sumAmounts(filtered)
  const previousTotal = previous ? sumAmounts(expenses.filter((e) => inRange(e.expense_date, previous))) : null
  const delta = previousTotal === null ? null : deltaPercent(total, previousTotal)
  const categories = groupExpensesByCategory(filtered)
  const months = groupExpensesByMonth(expenses, 12, now)
  const max = Math.max(1, ...months.map((m) => m.total))
  const transfers = settlements.filter((s) => inRange(s.settled_at, range))
  const transferred = sumAmounts(transfers)
  function historyHref(category?: string) {
    const params = historyRangeQuery(range)
    if (category) params.set('cat', category)
    return '/spese?' + params.toString()
  }

  return <div className="space-y-5 px-4 pb-8 pt-6">
    <h1 className="font-display text-3xl font-semibold">Statistiche</h1>
    <SegmentedControl groupId="stats-period" label="Periodo delle statistiche" value={period} onChange={(value) => setPeriod(value as Period)}
      options={[{ value: 'month', label: 'Mese' }, { value: '3months', label: '3 mesi' }, { value: 'year', label: 'Anno' }, { value: 'all', label: 'Tutto' }]} />
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Spese totali</h2><p className="mt-1 text-xs text-muted">{rangeLabel(range)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3"><p className="font-display text-display-sm font-semibold tabular-nums">{formatEur(total)}</p>
        {delta !== null && <span className="rounded-full bg-surface-raised px-3 py-1 text-sm tabular-nums">{delta > 0 ? '+' : ''}{delta.toFixed(0)}%</span>}</div>
      {previous && <p className="mt-2 text-xs leading-relaxed text-muted">Confronto: {rangeLabel(previous)} · {formatEur(previousTotal ?? 0)}{delta === null ? ' · percentuale non calcolabile senza spese precedenti' : ''}</p>}
      <Link href={historyHref()} className="mt-3 flex min-h-11 items-center gap-1 text-sm font-semibold text-accent">Apri i {filtered.length} movimenti <ArrowUpRight className="size-4" aria-hidden /></Link>
    </Card>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card className="min-w-0 p-5">
        <h2 className="text-base font-semibold">Ultimi 12 mesi</h2>
        <p className="mt-1 text-xs text-muted">Importi totali prima della divisione</p>
        <div className="mt-4 flex h-44 items-end gap-1" role="img" aria-label="Andamento mensile: valori e collegamenti disponibili nel riepilogo sottostante.">
          {months.map((month) => <div key={month.monthKey} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2 text-center">
            <div className="mx-auto w-3/4 rounded-t-md bg-accent/70" style={{ height: month.total ? Math.max(2, month.total / max * 140) : 2 }} title={month.label + ' ' + month.year + ': ' + formatEur(month.total)} />
            <span className="text-[11px] text-muted">{month.label}</span>
          </div>)}
        </div>
        <details className="mt-4 border-t border-border">
          <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">Valori mensili e movimenti</summary>
          <table className="w-full text-sm"><caption className="sr-only">Spese mensili negli ultimi dodici mesi</caption><thead><tr className="text-left text-xs text-muted"><th scope="col">Mese</th><th scope="col" className="text-right">Totale</th></tr></thead>
            <tbody>{months.map((month) => <tr key={month.monthKey} className="border-t border-border"><th scope="row" className="text-left font-normal"><Link className="flex min-h-11 items-center text-accent underline underline-offset-4" href={'/spese?mese=' + month.monthKey}>{month.label} {month.year}</Link></th><td className="text-right tabular-nums">{formatEur(month.total)}</td></tr>)}</tbody></table>
        </details>
      </Card>

      <Card className="min-w-0 p-5">
        <h2 className="text-base font-semibold">Per categoria</h2>
        <p className="mt-1 text-xs text-muted">{rangeLabel(range)}</p>
        {categories.length === 0 ? <p className="py-8 text-sm text-muted">Nessuna spesa nel periodo selezionato.</p> :
          <ul className="mt-4 space-y-2">{categories.map((item) => {
            const share = total ? item.total / total * 100 : 0
            return <li key={item.category}><Link href={historyHref(item.category)} className="block rounded-2xl p-2 hover:bg-surface-raised">
              <div className="flex items-center gap-2"><CategoryIcon category={item.category} size="sm" /><span className="min-w-0 flex-1 break-words text-sm font-medium">{CATEGORY_LABELS[item.category]}</span>
                <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{formatEur(item.total)}</span><span className="text-xs text-muted">{share.toFixed(0)}% · {item.count} spese</span></span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden><div className="h-full rounded-full" style={{ width: share + '%', backgroundColor: categoryHex(item.category, dark) }} /></div>
            </Link></li>
          })}</ul>}
      </Card>
    </div>

    <Card className="p-5">
      <h2 className="text-base font-semibold">Conguagli registrati</h2><p className="mt-1 text-xs text-muted">{rangeLabel(range)}</p>
      <div className="mt-4 grid gap-3 rounded-2xl bg-surface-raised p-4 sm:grid-cols-3">
        {[['Numero', String(transfers.length)], ['Importo medio', transfers.length ? formatEur(transferred / transfers.length) : '—'], ['Totale trasferito', transfers.length ? formatEur(transferred) : '—']].map(([label, value]) =>
          <div key={label} className="flex items-center justify-between gap-3 sm:block"><p className="text-xs text-muted">{label}</p><p className="font-display text-xl font-semibold tabular-nums">{value}</p></div>)}
      </div>
      {transfers.length === 0 ? <p className="py-5 text-sm text-muted">Nessun conguaglio nel periodo.</p> :
        <ul className="mt-4 divide-y divide-border">{transfers.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 py-4">
          <div className="min-w-0"><p className="flex flex-wrap items-center gap-1 text-sm font-medium">{s.from_user?.display_name ?? '—'}<ArrowRight className="size-4 shrink-0 text-muted" aria-label="ha versato a" />{s.to_user?.display_name ?? '—'}</p><p className="mt-1 break-words text-xs text-muted">{formatDate(s.settled_at)}{s.notes ? ' · ' + s.notes : ''}</p></div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatEur(s.amount)}</p>
        </li>)}</ul>}
    </Card>
  </div>
}
