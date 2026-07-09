'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { OptimisticExpense as OptimisticExpenseShape } from '@/app/(app)/spese/nuova/ExpenseForm'
import { formatDateShort } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { Tables } from '@/types/database'

type Expense = Tables<'expenses'> & {
  paid_by_profile: { display_name: string } | null
}
type Profile = Tables<'profiles'>
type BalanceRow = Tables<'v_user_open_balance'>

export type OptimisticExpense = OptimisticExpenseShape

interface HomeShellProps {
  userId: string
  balanceRows: BalanceRow[]
  recentExpenses: Expense[]
  profiles: Profile[]
  suggestions: string[]
}

export function HomeShell({
  userId,
  balanceRows,
  recentExpenses,
  profiles,
  suggestions,
}: HomeShellProps) {
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
    <div className="flex flex-col px-4 pb-4">
      <div className="relative isolate -mx-4 flex flex-col gap-5 overflow-hidden px-4 pt-6 pb-8">
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 -z-10',
            'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent-muted)_28%,var(--background))_0%,color-mix(in_oklab,var(--surface)_64%,var(--background))_56%,var(--background)_100%)]',
          )}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-background"
        />

        <BalanceCard rows={balanceRows} currentUserId={userId} />

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Ultime spese
            </h2>
            <Link href="/spese" className="text-sm font-medium text-accent">
              Vedi tutte
            </Link>
          </div>

          {combined.length === 0 ? (
            <Card className="bg-surface/86 backdrop-blur">
              <p className="px-4 py-6 text-center text-sm text-muted">
                Nessuna spesa ancora. Aggiungine una!
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden bg-surface/86 p-0 backdrop-blur">
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
                          className={cn(
                            'absolute right-3 top-1/2 -translate-y-1/2',
                            'text-muted',
                          )}
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

      <NuovaSpesaFab
        profiles={profiles}
        currentUserId={userId}
        suggestions={suggestions}
        onOptimisticInsert={pushOptimistic}
      />
    </div>
  )
}
