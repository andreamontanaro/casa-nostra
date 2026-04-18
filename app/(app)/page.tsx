import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getOpenBalance, getRecentExpenses, getCurrentUser } from '@/lib/queries'
import { BalanceCard } from '@/components/BalanceCard'
import { ExpenseRow } from '@/components/ExpenseRow'
import { Card } from '@/components/ui/Card'
import { formatDateShort } from '@/lib/fmt'

export default async function HomePage() {
  const [user, balanceRows, expenses] = await Promise.all([
    getCurrentUser(),
    getOpenBalance(),
    getRecentExpenses(5),
  ])

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Casa Nostra</h1>

      {user && (
        <BalanceCard rows={balanceRows} currentUserId={user.id} />
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Ultime spese
          </h2>
          <Link href="/spese" className="text-sm font-medium text-accent">
            Vedi tutte
          </Link>
        </div>

        {expenses.length === 0 ? (
          <Card>
            <p className="px-4 py-6 text-center text-sm text-muted">
              Nessuna spesa ancora. Aggiungine una!
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {expenses.map((expense) => (
              <div key={expense.id} className="relative">
                <span className="absolute right-16 top-3 text-xs text-muted">
                  {formatDateShort(expense.expense_date)}
                </span>
                <ExpenseRow expense={expense} />
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* FAB */}
      <Link
        href="/spese/nuova"
        aria-label="Nuova spesa"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg active:opacity-80 transition-opacity"
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>
    </div>
  )
}
