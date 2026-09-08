import {
  getOpenBalance,
  getRecentExpenses,
  getCurrentUser,
  getProfiles,
  getFrequentDescriptions,
} from '@/lib/queries'
import { HomeShell } from '@/components/HomeShell'

export default async function HomePage() {
  const [user, balanceRows, recentExpenses, profiles, suggestions] =
    await Promise.all([
      getCurrentUser(),
      getOpenBalance(),
      getRecentExpenses(5),
      getProfiles(),
      getFrequentDescriptions(5),
    ])

  if (!user) return null

  return (
    <HomeShell
      userId={user.id}
      balanceRows={balanceRows}
      recentExpenses={recentExpenses}
      profiles={profiles}
      suggestions={suggestions}
    />
  )
}
