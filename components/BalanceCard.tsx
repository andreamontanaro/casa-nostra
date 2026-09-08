'use client'

import Link from 'next/link'
import { ArrowUpRight, Check, Sparkles } from 'lucide-react'
import { SpendingRing } from '@/components/SpendingRing'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { CATEGORY_LABELS, formatEur } from '@/lib/fmt'
import { categoryTotals } from '@/lib/spending'
import { openAssistant } from '@/lib/assistant/ui'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import type { Tables } from '@/types/database'

interface Props {
  rows: Tables<'v_user_open_balance'>[]
  currentUserId: string
  expenses: OpenExpenseWithContribution[]
}

export function BalanceCard({ rows, currentUserId, expenses }: Props) {
  const me = rows.find((r) => r.user_id === currentUserId)
  const other = rows.find((r) => r.user_id !== currentUserId)
  if (!me || !other) return (
    <Card className="p-6"><h2 className="font-semibold">Saldo non disponibile</h2>
      <p className="mt-2 text-sm text-muted">Il saldo comparirà quando entrambi i profili saranno configurati.</p></Card>
  )
  const net = me.net_position ?? 0
  const categories = categoryTotals(expenses)
  const otherName = other.display_name?.split(' ')[0] ?? 'il partner'

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Il vostro saldo</h2>
        <span className="rounded-full bg-accent-muted px-3 py-1 text-xs font-medium text-accent-soft">
          {expenses.length} {expenses.length === 1 ? 'spesa aperta' : 'spese aperte'}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <SpendingRing categories={categories} categoryHref={(cat) => `/spese?stato=aperte&cat=${cat}`}>
          {net === 0 ? (
            <><Check className="mb-2 size-6 text-accent" aria-hidden /><p className="font-display text-3xl font-semibold">Siete in pari</p>
              <p className="mt-2 text-xs text-muted">{expenses.length ? 'Le spese si compensano' : 'Un nuovo inizio, insieme'}</p></>
          ) : (
            <><p className="max-w-full text-sm text-muted">{net > 0 ? 'Devi ricevere' : 'Devi dare'}</p>
              <AmountDisplay value={Math.abs(net)} className={`mt-2 max-w-full whitespace-nowrap ${Math.abs(net) >= 10000 ? 'text-[1.8rem]' : 'text-[2.5rem]'}`} />
              <p className="mt-2 max-w-full break-words text-sm font-medium">{net > 0 ? 'da' : 'a'} {otherName}</p></>
          )}
        </SpendingRing>
        {net !== 0 && <Link href="/conguaglio" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong text-sm font-semibold text-accent">
          Regola il saldo <ArrowUpRight className="size-4" aria-hidden /></Link>}
      </div>
      <details className="border-t border-border">
        <summary className="min-h-12 px-5 py-4 text-sm font-semibold">Come si forma il saldo</summary>
        <div className="space-y-4 px-5 pb-5 text-sm">
          <p className="text-muted">L’anello mostra le categorie degli importi totali. Il saldo è la differenza tra quello che ciascuno ha anticipato e la sua quota.</p>
          <div className="space-y-3">
            {[me, other].map((person) => <div key={person.user_id} className="flex items-center gap-3">
              <Avatar name={person.display_name} /><div className="min-w-0 flex-1"><p className="font-semibold">{person.user_id === currentUserId ? 'Tu' : person.display_name}</p><p className="text-xs text-muted">Quota: {formatEur(person.total_owed ?? 0)}</p></div>
              <div className="text-right"><p className="font-semibold tabular-nums">{formatEur(person.total_anticipated ?? 0)}</p><p className="text-xs text-muted">anticipati</p></div>
            </div>)}
          </div>
          {categories.map((item) => (
            <div key={item.category} className="border-t border-border pt-3">
              <div className="flex justify-between gap-3"><span>{CATEGORY_LABELS[item.category]}</span><span className="font-semibold tabular-nums">{item.contribution > 0 ? '+' : ''}{formatEur(item.contribution)}</span></div>
              <p className="mt-1 text-xs text-muted">{item.contribution > 0 ? 'A tuo favore' : item.contribution < 0 ? 'A favore del partner' : 'Si compensa'}</p>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className={item.contribution >= 0 ? 'bg-accent' : 'bg-muted'} style={{ width: `${Math.max(2, Math.abs(item.contribution) / Math.max(1, ...categories.map((c) => Math.abs(c.contribution))) * 100)}%` }} /></div>
            </div>
          ))}
          <Button variant="secondary" size="sm" className="w-full" onClick={() => openAssistant('Spiegami come si forma il saldo corrente e quali categorie incidono di più.')}><Sparkles className="size-4" aria-hidden />Chiedi all’assistente</Button>
        </div>
      </details>
    </Card>
  )
}
