'use client'

import Link from 'next/link'
import { ArrowLeftRight, BarChart3, Check, PieChart, Plus, type LucideIcon } from 'lucide-react'
import { SpendingRing } from '@/components/SpendingRing'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { Card } from '@/components/ui/Card'
import { categoryTotals } from '@/lib/spending'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import type { Tables } from '@/types/database'

interface Props {
  rows: Tables<'v_user_open_balance'>[]
  currentUserId: string
  expenses: OpenExpenseWithContribution[]
  /** In home l'anello si disegna all'apertura della schermata. */
  reveal?: boolean
  /**
   * Riceve la scritta al centro dell'anello (la cifra, o «Siete in pari»):
   * la home la fa volare nella barra del saldo quando si scorre
   * (`components/BalanceStrip.tsx`).
   */
  headlineRef?: (el: HTMLElement | null) => void
  /** Riceve il riquadro dell'anello, che in home si srotola nella stessa barra. */
  ringRef?: React.Ref<HTMLDivElement>
  /** Apre il modulo «Nuova spesa» della home; senza, l'azione porta a `/spese/nuova`. */
  onNewExpense?: () => void
}

/** Classi della cifra al centro dell'anello: più è lunga, più è piccola. */
export function balanceAmountClass(amount: number) {
  return `whitespace-nowrap ${amount >= 1000000 ? 'text-[.8rem]' : amount >= 10000 ? 'text-[1rem]' : amount >= 1000 ? 'text-[1.2rem]' : 'text-[1.65rem]'}`
}

/** Classi di «Siete in pari» al centro dell'anello. */
export const BALANCE_EVEN_CLASS = 'font-display text-xl font-semibold'

export function BalanceCard({ rows, currentUserId, expenses, reveal = false, headlineRef, ringRef, onNewExpense }: Props) {
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
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 p-4">
        <SpendingRing compact reveal={reveal} categories={categories} frameRef={ringRef}>
          {net === 0 ? (
            <><Check className="mb-1 size-5 text-accent" aria-hidden /><p ref={headlineRef} className={BALANCE_EVEN_CLASS}>Siete in pari</p>
              {expenses.length > 0 && <p className="mt-2 text-xs text-muted">Le spese si compensano</p>}</>
          ) : (
            <><p className="max-w-full text-sm text-muted">{net > 0 ? 'Devi ricevere' : 'Devi dare'}</p>
              <AmountDisplay ref={headlineRef} value={Math.abs(net)} className={`mt-1 max-w-full ${balanceAmountClass(Math.abs(net))}`} />
              <p className="mt-2 max-w-full break-words text-sm font-medium">{net > 0 ? 'da' : 'a'} {otherName}</p></>
          )}
        </SpendingRing>
        <div className="min-w-0"><h2 className="text-sm font-semibold">Il vostro saldo</h2><p className="mt-2 text-xs text-muted">{expenses.length} {expenses.length === 1 ? 'spesa aperta' : 'spese aperte'}</p></div>
      </div>
      <QuickActions onNewExpense={onNewExpense} />
    </Card>
  )
}

const ACTION_CLASS = 'flex min-h-[4.75rem] min-w-0 flex-col items-center justify-start gap-1.5 rounded-2xl px-1 pt-1 text-center text-xs font-semibold leading-tight text-foreground transition-colors hover:bg-surface-raised active:bg-surface-raised'

function ActionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent-soft"><Icon className="size-5" aria-hidden /></span>
}

/**
 * Azioni rapide sotto l'anello: nuova spesa, conguaglio, statistiche e i
 * dettagli del saldo (`/saldo`). Il conguaglio c'è anche a saldo zero: la sua
 * schermata spiega da sola che non c'è niente da regolare.
 */
function QuickActions({ onNewExpense }: { onNewExpense?: () => void }) {
  const links: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/conguaglio', label: 'Regola saldo', icon: ArrowLeftRight },
    { href: '/statistiche', label: 'Statistiche', icon: BarChart3 },
    { href: '/saldo', label: 'Dettagli', icon: PieChart },
  ]
  return (
    <nav aria-label="Azioni rapide" className="grid grid-cols-4 gap-1 border-t border-border px-2 py-3">
      {onNewExpense
        ? <button type="button" onClick={onNewExpense} className={ACTION_CLASS}><ActionIcon icon={Plus} />Nuova spesa</button>
        : <Link href="/spese/nuova" className={ACTION_CLASS}><ActionIcon icon={Plus} />Nuova spesa</Link>}
      {links.map(({ href, label, icon }) => <Link key={href} href={href} className={ACTION_CLASS}><ActionIcon icon={icon} />{label}</Link>)}
    </nav>
  )
}
