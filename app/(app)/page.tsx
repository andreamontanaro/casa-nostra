import {
  getOpenBalance,
  getOpenExpensesWithShares,
  getRecentExpenses,
  getCurrentUser,
  getProfiles,
  getFrequentDescriptions,
  withContribution,
} from '@/lib/queries'
import { HomeShell } from '@/components/HomeShell'

export default async function HomePage() {
  // Tutte in parallelo: le spese aperte non aspettano l'utente, il contributo
  // di ognuna si calcola dopo sulle quote già lette.
  const [user, balanceRows, recentExpenses, profiles, suggestions, open] =
    await Promise.all([
      getCurrentUser(),
      getOpenBalance(),
      getRecentExpenses(5),
      getProfiles(),
      getFrequentDescriptions(5),
      getOpenExpensesWithShares(),
    ])

  if (!user) return null
  const openExpenses = withContribution(open, user.id)

  return (
    <HomeShell
      userId={user.id}
      openExpenses={openExpenses}
      balanceRows={balanceRows}
      recentExpenses={recentExpenses}
      profiles={profiles}
      suggestions={suggestions}
    />
  )
}
