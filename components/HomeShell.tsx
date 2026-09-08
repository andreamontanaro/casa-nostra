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
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      <BalanceCard rows={balanceRows} currentUserId={userId} />

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-label font-semibold uppercase tracking-wide text-muted">
            Ultime spese
          </h2>
          <Link href="/spese" className="text-sm font-medium text-accent">
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

      <NuovaSpesaFab
        profiles={profiles}
        currentUserId={userId}
        suggestions={suggestions}
        onOptimisticInsert={pushOptimistic}
      />
    </div>
  )
}
