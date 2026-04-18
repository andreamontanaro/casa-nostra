import { ArrowRight } from 'lucide-react'
import { getOpenBalance, getCurrentUser, getAllExpenses } from '@/lib/queries'
import { ConguaglioClient } from './ConguaglioClient'
import { Card, CardContent } from '@/components/ui/Card'
import { formatEur, formatDate, CATEGORY_LABELS } from '@/lib/fmt'

export default async function ConguaglioPage() {
  const [user, balanceRows, expenses] = await Promise.all([
    getCurrentUser(),
    getOpenBalance(),
    getAllExpenses(),
  ])

  if (!user) return null

  const me = balanceRows.find((r) => r.user_id === user.id)
  const other = balanceRows.find((r) => r.user_id !== user.id)

  const netMe = me?.net_position ?? 0
  const absAmount = Math.abs(netMe)
  const hasBalance = netMe !== 0

  const isCredit = netMe > 0
  const payer = isCredit ? other?.display_name : 'Tu'
  const receiver = isCredit ? 'Te' : other?.display_name

  const openExpenses = expenses.filter((e) => e.settlement_id === null)

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-6">
      <h1 className="text-xl font-semibold text-foreground">Conguaglio</h1>

      {/* Card saldo netto */}
      <Card>
        <CardContent className="py-5">
          {!hasBalance ? (
            <p className="text-center text-base font-medium text-foreground">
              Siete pari — niente da conguagliare.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-3xl font-bold text-foreground">{formatEur(absAmount)}</p>
              <div className="flex items-center gap-3 text-sm font-medium text-muted">
                <span className={isCredit ? 'text-foreground' : ''}>{payer}</span>
                <ArrowRight className="size-4 text-accent" />
                <span className={!isCredit ? 'text-foreground' : ''}>{receiver}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spese aperte */}
      {openExpenses.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            Spese che verranno chiuse ({openExpenses.length})
          </h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {openExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{e.description}</p>
                  <p className="text-xs text-muted">
                    {formatDate(e.expense_date)} · {CATEGORY_LABELS[e.category]}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-sm font-semibold text-foreground">
                  {formatEur(e.amount)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <ConguaglioClient hasBalance={hasBalance} />
    </div>
  )
}
