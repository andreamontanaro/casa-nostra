'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import type { ExpenseSuggestion, OpenExpenseWithContribution } from '@/lib/queries'
import { AnimatePresence, motion } from 'motion/react'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import { Card } from '@/components/ui/Card'
import { formatDateShort, formatEur } from '@/lib/fmt'
import { revealDelay } from '@/lib/motion'
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
}

export function HomeShell({
  userId,
  openExpenses,
  balanceRows,
  recentExpenses,
  upcomingExpenses,
  profiles,
  suggestions,
}: HomeShellProps) {
  const [formOpen, setFormOpen] = useState(false)
  const combined = recentExpenses.slice(0, 5)
  // Le ultime spese sono quasi sempre aperte: il loro effetto sul saldo è
  // già stato calcolato per l'anello, basta ritrovarlo per id.
  const contributions = new Map(openExpenses.map((e) => [e.id, e.my_contribution]))
  const upcomingTotal = upcomingExpenses.reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100
  // Con le spese future in cima, le ultime spese arrivano un passo dopo.
  const recentStep = upcomingExpenses.length > 0 ? 3 : 2
  return (
    <div className="px-4 pt-4 pb-24 lg:pb-6">
      <header className="mb-4 px-1 reveal-up">
        <div><h1 className="font-display text-3xl font-semibold tracking-tight">Ciao, {profiles.find((p) => p.id === userId)?.display_name.split(' ')[0] ?? 'bentornato'}.</h1></div>
      </header>
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_1.3fr]">
      <div className="min-w-0 reveal-up" style={revealDelay(1)}>
        <BalanceCard rows={balanceRows} currentUserId={userId} expenses={openExpenses} reveal />
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

        {combined.length === 0 ? (
          <div className="reveal-up" style={revealDelay(recentStep + 1)}>
            <Card>
              <p className="px-4 py-8 text-center text-sm text-muted">
                {upcomingExpenses.length > 0 ? 'Nessuna spesa fino a oggi.' : 'Nessuna spesa ancora. Aggiungine una!'}
              </p>
            </Card>
          </div>
        ) : (
          <ExpenseCard expenses={combined} step={recentStep + 1} contributions={contributions} profiles={profiles} />
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

/** Le righe di una sezione della home, che entrano una dopo l'altra da `step`. */
function ExpenseCard({ expenses, step, contributions, profiles }: {
  expenses: Expense[]
  step: number
  contributions: Map<string, number>
  profiles: Profile[]
}) {
  return (
    <Card className="divide-y divide-border overflow-hidden p-0 reveal-up" style={revealDelay(step)}>
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
