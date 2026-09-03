import {
  getCurrentUser,
  getOpenExpensesWithContribution,
  getProfiles,
} from '@/lib/queries'
import { isTelegramConfigured } from '@/lib/telegram/config'
import { ConguaglioClient } from './ConguaglioClient'

export default async function ConguaglioPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [profiles, expenses] = await Promise.all([
    getProfiles(),
    getOpenExpensesWithContribution(user.id),
  ])

  const other = profiles.find((p) => p.id !== user.id)
  const otherUserName = other?.display_name ?? 'Altro'

  return (
    <div className="flex flex-col gap-5 px-4 pt-6">
      <h1 className="text-xl font-semibold text-foreground">Conguaglio</h1>
      <ConguaglioClient
        expenses={expenses}
        otherUserName={otherUserName}
        telegramEnabled={isTelegramConfigured()}
      />
    </div>
  )
}
