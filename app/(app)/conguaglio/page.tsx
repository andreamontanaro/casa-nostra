import {
  getOpenBalance,
  getCurrentUser,
  getOpenExpensesWithContribution,
  getProfiles,
} from '@/lib/queries'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { ConguaglioClient } from './ConguaglioClient'

export default async function ConguaglioPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [profiles, expenses, balances] = await Promise.all([
    getProfiles(),
    getOpenExpensesWithContribution(user.id),
    getOpenBalance(),
  ])

  const other = profiles.find((p) => p.id !== user.id)
  const otherUserName = other?.display_name ?? 'Altro'

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <header className="px-1"><p className="mb-1 text-sm text-muted">Un conto in meno a cui pensare.</p><h1 className="font-display text-3xl font-semibold">Regola il saldo</h1></header>
      <ConguaglioClient
        expenses={expenses}
        officialNet={balances.find((b) => b.user_id === user.id)?.net_position ?? 0}
        otherUserName={otherUserName}
        telegramEnabled={isTelegramConfigured()}
      />
    </div>
  )
}
