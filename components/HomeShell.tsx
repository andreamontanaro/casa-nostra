'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { ExpenseForm } from '@/app/(app)/spese/nuova/ExpenseForm'
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
  const [sheetOpen, setSheetOpen] = useState(false)
  const [optimistic, setOptimistic] = useState<OptimisticExpense[]>([])

  // Reset optimistic quando il server torna con nuovi dati
  useEffect(() => {
    setOptimistic([])
  }, [recentExpenses])

  function pushOptimistic(e: OptimisticExpense) {
    setOptimistic((prev) => [e, ...prev])
    setSheetOpen(false)
  }

  const combined = [...optimistic, ...recentExpenses].slice(0, 5)

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Casa Nostra</h1>

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
          <Card>
            <p className="px-4 py-6 text-center text-sm text-muted">
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
                    <span className="absolute right-16 top-3 text-xs text-muted">
                      {formatDateShort(expense.expense_date)}
                    </span>
                    <ExpenseRow expense={expense} />
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

      {/* FAB → Sheet */}
      <motion.button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Nuova spesa"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.1 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4',
          'flex size-14 items-center justify-center rounded-full',
          'bg-accent text-accent-foreground shadow-fab',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </motion.button>

      <Sheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Nuova spesa"
        description="Pre-compila gli ultimi campi più frequenti."
      >
        <ExpenseForm
          profiles={profiles}
          currentUserId={userId}
          suggestions={suggestions}
          onOptimisticInsert={pushOptimistic}
        />
      </Sheet>
    </div>
  )
}
