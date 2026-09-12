'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { OpenExpenseWithContribution } from '@/lib/queries'
import { AnimatePresence, motion } from 'motion/react'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { NuovaSpesaFab } from '@/components/NuovaSpesaFab'
import { Card } from '@/components/ui/Card'
import { formatDateShort } from '@/lib/fmt'
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
  const combined = recentExpenses.slice(0, 5)
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

      <section>
        <div className="mb-3 flex items-center justify-between px-1 reveal-up" style={revealDelay(2)}>
          <h2 className="text-base font-semibold text-foreground">
            Ultime spese
          </h2>
          <Link href="/spese" className="flex min-h-11 items-center text-sm font-semibold text-accent">
            Vedi tutte
          </Link>
        </div>

        {combined.length === 0 ? (
          <div className="reveal-up" style={revealDelay(3)}>
            <Card>
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nessuna spesa ancora. Aggiungine una!
              </p>
            </Card>
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0 reveal-up" style={revealDelay(3)}>
            <AnimatePresence initial={false}>
              {combined.map((expense, index) => {
                return (
                  <motion.div
                    key={expense.id}
                    initial={false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative reveal-up"
                    style={revealDelay(3 + index * 0.5)}
                  >
                    <ExpenseRow
                      expense={expense}
                      dateLabel={formatDateShort(expense.expense_date)}
                    />

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
      />
    </div>
  )
}
