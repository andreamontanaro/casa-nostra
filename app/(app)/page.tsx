import {
  getOpenBalance,
  getOpenExpensesWithShares,
  getRecentExpenses,
  getUpcomingExpenses,
  getCurrentUser,
  getProfiles,
  getFrequentDescriptions,
  withContribution,
} from '@/lib/queries'
import { HomeShell } from '@/components/HomeShell'
import { todayISO } from '@/lib/fmt'

export default async function HomePage() {
  const today = todayISO()
  // Tutte in parallelo: le spese aperte non aspettano l'utente, il contributo
  // di ognuna si calcola dopo sulle quote già lette.
  const [user, balanceRows, recentExpenses, upcomingExpenses, profiles, suggestions, open] =
    await Promise.all([
      getCurrentUser(),
      getOpenBalance(),
      getRecentExpenses(today, 5),
      getUpcomingExpenses(today),
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
      upcomingExpenses={upcomingExpenses}
      profiles={profiles}
      suggestions={suggestions}
    />
  )
}
