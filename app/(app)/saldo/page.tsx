import { getCurrentUser, getOpenBalance, getOpenExpensesWithShares, withContribution } from '@/lib/queries'
import { BalanceDetails } from '@/components/BalanceDetails'

export default async function SaldoPage() {
  const [user, balanceRows, open] = await Promise.all([
    getCurrentUser(),
    getOpenBalance(),
    getOpenExpensesWithShares(),
  ])
  if (!user) return null

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-24 lg:pb-6">
      <header className="px-1"><p className="mb-1 text-sm text-muted">Come si forma il saldo di adesso.</p><h1 className="font-display text-3xl font-semibold">Dettagli del saldo</h1></header>
      <BalanceDetails rows={balanceRows} currentUserId={user.id} expenses={withContribution(open, user.id)} />
    </div>
  )
}
