'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import type { ExpenseSuggestion, OpenExpenseWithContribution } from '@/lib/queries'
import { AnimatePresence, motion } from 'motion/react'
import { BalanceCard } from '@/components/BalanceCard'
import { BalanceStrip } from '@/components/BalanceStrip'
import { HeaderActions } from '@/components/HeaderActions'
import { ExpenseRow } from '@/components/ExpenseRow'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import { Card } from '@/components/ui/Card'
import { formatDateShort, formatEur } from '@/lib/fmt'
import { revealDelay } from '@/lib/motion'
import { groupRecent } from '@/lib/recent-groups'
import type { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}
type Profile = Tables<'profiles'>
type BalanceRow = Tables<'v_user_open_balance'>


interface HomeShellProps {
  openExpenses: OpenExpenseWithContribution[]
  userId: string
  balanceRows: BalanceRow[]
  recentExpenses: Expense[]
  /** Spese datate dopo oggi, dalla più vicina: stanno in una sezione loro. */
  upcomingExpenses: Expense[]
  profiles: Profile[]
  suggestions: ExpenseSuggestion[]
  /** Oggi nel fuso della casa (`todayISO()`): divide le ultime spese in gruppi. */
  today: string
}

export function HomeShell({
  userId,
  openExpenses,
  balanceRows,
  recentExpenses,
  upcomingExpenses,
  profiles,
  suggestions,
  today,
}: HomeShellProps) {
  const [formOpen, setFormOpen] = useState(false)
  const balanceRing = useRef<HTMLDivElement>(null)
  const balanceHeadline = useRef<HTMLElement | null>(null)
  const setBalanceHeadline = useCallback((el: HTMLElement | null) => { balanceHeadline.current = el }, [])
  // Le ultime spese sono quasi sempre aperte: il loro effetto sul saldo è
  // già stato calcolato per l'anello, basta ritrovarlo per id.
  const contributions = new Map(openExpenses.map((e) => [e.id, e.my_contribution]))
  const upcomingTotal = upcomingExpenses.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100
  // Con le spese future in cima, le ultime spese arrivano un passo dopo.
  const recentStep = upcomingExpenses.length > 0 ? 3 : 2
  return (
    <div className="px-4 pt-4 pb-24 lg:pb-6">
      <BalanceStrip rows={balanceRows} currentUserId={userId} expenses={openExpenses} headline={balanceHeadline} ring={balanceRing} />
      <header className="mb-4 flex items-center gap-3 px-1 reveal-up">
        <h1 className="min-w-0 flex-1 font-display text-3xl font-semibold tracking-tight">Ciao, {profiles.find((p) => p.id === userId)?.display_name.split(' ')[0] ?? 'bentornato'}.</h1>
        <HeaderActions />
      </header>
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.3fr]">
      <div className="min-w-0 reveal-up" style={revealDelay(1)}>
        <BalanceCard rows={balanceRows} currentUserId={userId} expenses={openExpenses} reveal headlineRef={setBalanceHeadline} ringRef={balanceRing} onNewExpense={() => setFormOpen(true)} />
      </div>
      <div className="flex min-w-0 flex-col gap-5">

      {upcomingExpenses.length > 0 && (
        <section aria-labelledby="home-upcoming">
          <div className="mb-3 flex items-center justify-between gap-3 px-1 reveal-up" style={revealDelay(2)}>
            <h2 id="home-upcoming" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CalendarClock className="size-4 text-accent" aria-hidden />
              Spese future
            </h2>
            <span className="text-sm font-semibold tabular-nums text-muted">{formatEur(upcomingTotal)}</span>
          </div>
          <ExpenseCard expenses={upcomingExpenses} step={2.5} contributions={contributions} profiles={profiles} />
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between px-1 reveal-up" style={revealDelay(recentStep)}>
          <h2 className="text-base font-semibold text-foreground">
            Ultime spese
          </h2>
          <Link href="/spese" className="flex min-h-11 items-center text-sm font-semibold text-accent">
            Vedi tutte
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="reveal-up" style={revealDelay(recentStep + 1)}>
            <Card>
              <p className="px-4 py-8 text-center text-sm text-muted">
                {upcomingExpenses.length > 0 ? 'Nessuna spesa fino a oggi.' : 'Nessuna spesa ancora. Aggiungine una!'}
              </p>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupRecent(recentExpenses, today).map((group, index) => (
              <div key={group.key} role="group" aria-labelledby={`home-recent-${group.key}`}>
                <h3 id={`home-recent-${group.key}`} className="mb-2 px-1 text-xs font-semibold text-muted reveal-up" style={revealDelay(recentStep + 1 + index * 0.5)}>
                  {group.label}
                </h3>
                <ExpenseCard expenses={group.expenses} step={recentStep + 1 + index * 0.5} contributions={contributions} profiles={profiles} />
              </div>
            ))}
          </div>
        )}
      </section>

      </div>
      </div>
      <NuovaSpesaFab
        open={formOpen}
        onOpenChange={setFormOpen}
        profiles={profiles}
        currentUserId={userId}
        suggestions={suggestions}
      />
    </div>
  )
}

/**
 * Le righe di una sezione della home, che entrano una dopo l'altra da `step`.
 * Pannello pulito, su richiesta: superficie senza bordo, ombra né righe di
 * divisione tra le spese.
 */
function ExpenseCard({ expenses, step, contributions, profiles }: {
  expenses: Expense[]
  step: number
  contributions: Map<string, number>
  profiles: Profile[]
}) {
  return (
    <Card className="overflow-hidden p-0 reveal-up" style={revealDelay(step)}>
      <AnimatePresence initial={false}>
        {expenses.map((expense, index) => (
          <motion.div
            key={expense.id}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative reveal-up"
            style={revealDelay(step + Math.min(index, 4) * 0.5)}
          >
            <ExpenseRow
              expense={expense}
              dateLabel={formatDateShort(expense.expense_date)}
              returnHref="/"
              contribution={contributions.get(expense.id)}
              profiles={profiles}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </Card>
  )
}
