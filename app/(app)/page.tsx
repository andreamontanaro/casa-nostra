import {
  getOpenBalance,
  getRecentExpenses,
  getCurrentUser,
  getProfiles,
  getFrequentDescriptions,
  getChoreStatus,
} from '@/lib/queries'
import { HomeShell } from '@/components/HomeShell'

export default async function HomePage() {
  const [user, balanceRows, recentExpenses, profiles, suggestions, choreStatus] =
    await Promise.all([
      getCurrentUser(),
      getOpenBalance(),
      getRecentExpenses(5),
      getProfiles(),
      getFrequentDescriptions(5),
      getChoreStatus(),
    ])

  if (!user) return null

  // Le più urgenti fra le sole ricorrenti: i gesti (cadenza libera) non hanno
  // una scadenza da segnalare in home, si registrano da /casa quando capitano.
  const urgentChores = choreStatus.filter((r) => r.cadence_days !== null).slice(0, 2)

  return (
    <HomeShell
      userId={user.id}
      balanceRows={balanceRows}
      recentExpenses={recentExpenses}
      profiles={profiles}
      suggestions={suggestions}
      urgentChores={urgentChores}
    />
  )
}
