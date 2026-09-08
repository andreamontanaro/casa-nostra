'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ShoppingBasket, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import { AnimatePresence, motion } from 'motion/react'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { OptimisticExpense as OptimisticExpenseShape } from '@/app/(app)/spese/nuova/ExpenseForm'
import { formatDateShort } from '@/lib/fmt'
import type { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}
type Profile = Tables<'profiles'>
type BalanceRow = Tables<'v_user_open_balance'>

export type OptimisticExpense = OptimisticExpenseShape

interface HomeShellProps {
  openExpenses: OpenExpenseWithContribution[]
  userId: string
  balanceRows: BalanceRow[]
  recentExpenses: Expense[]
  profiles: Profile[]
  suggestions: string[]
}

export function HomeShell({
  userId,
  openExpenses,
  balanceRows,
  recentExpenses,
  profiles,
  suggestions,
}: HomeShellProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [optimistic, setOptimistic] = useState<OptimisticExpense[]>([])
  const [optimisticBaseKey, setOptimisticBaseKey] = useState('')
  const recentExpensesKey = recentExpenses.map((expense) => expense.id).join('|')
  const visibleOptimistic =
    optimisticBaseKey === recentExpensesKey ? optimistic : []

  function pushOptimistic(e: OptimisticExpense) {
    setOptimisticBaseKey(recentExpensesKey)
    setOptimistic((prev) => [e, ...prev])
  }

  const combined = [...visibleOptimistic, ...recentExpenses].slice(0, 5)

  return (
    <div className="px-4 pt-6 pb-24 lg:pb-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 px-1">
        <div><p className="mb-1 text-sm text-muted">Le piccole cose, insieme.</p><h1 className="font-display text-3xl font-semibold tracking-tight">Ciao, {profiles.find((p) => p.id === userId)?.display_name.split(' ')[0] ?? 'bentornato'}.</h1></div>
        <Button onClick={() => setFormOpen(true)}><Plus className="size-5" aria-hidden />Aggiungi spesa</Button>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_1fr]">
      <BalanceCard rows={balanceRows} currentUserId={userId} expenses={openExpenses} />
      <div className="flex min-w-0 flex-col gap-5">
      <Link href="/lista" className="flex min-h-20 items-center gap-3 rounded-3xl bg-accent-muted p-5 text-accent-soft">
        <ShoppingBasket className="size-6" aria-hidden /><div className="flex-1"><p className="font-semibold">Cosa manca in casa?</p><p className="mt-1 text-sm">Apri la lista della spesa</p></div><ArrowUpRight className="size-5" aria-hidden />
      </Link>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-foreground">
            Ultime spese
          </h2>
          <Link href="/spese" className="flex min-h-11 items-center text-sm font-semibold text-accent">
            Vedi tutte
          </Link>
        </div>

        {combined.length === 0 ? (
          <Card>
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nessuna spesa ancora. Aggiungine una!
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            <AnimatePresence initial={false}>
              {combined.map((expense) => {
                const isOpt = '__optimistic' in expense
                return (
                  <motion.div
                    key={expense.id}
                    initial={isOpt ? { opacity: 0, y: -8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative"
                  >
                    <ExpenseRow
                      expense={expense}
                      dateLabel={formatDateShort(expense.expense_date)}
                    />
                    {isOpt && (
                      <span
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                        aria-label="In salvataggio"
                      >
                        <Spinner size="sm" />
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </Card>
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
        onOptimisticInsert={pushOptimistic}
      />
    </div>
  )
}
