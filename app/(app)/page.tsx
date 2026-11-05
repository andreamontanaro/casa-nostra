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
import { createClient } from '@/lib/supabase/server'
import { getUpcomingSubscriptions } from '@/lib/subscriptions/service'

/** Quante spese passate mostra la home: abbastanza da scorrerle senza aprire lo storico. */
const RECENT_EXPENSES = 20

export default async function HomePage() {
  const today = todayISO()
  // Tutte in parallelo: le spese aperte non aspettano l'utente, il contributo
  // di ognuna si calcola dopo sulle quote già lette.
  const [user, balanceRows, recentExpenses, upcomingExpenses, profiles, suggestions, open, upcomingSubs] =
    await Promise.all([
      getCurrentUser(),
      getOpenBalance(),
      getRecentExpenses(today, RECENT_EXPENSES),
      getUpcomingExpenses(today),
      getProfiles(),
      getFrequentDescriptions(5),
      getOpenExpensesWithShares(),
      createClient().then((db) => getUpcomingSubscriptions(db, today)),
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
      upcomingSubscriptions={upcomingSubs.subscriptions}
      notifyHour={upcomingSubs.notifyHour}
      profiles={profiles}
      suggestions={suggestions}
      today={today}
    />
  )
}
