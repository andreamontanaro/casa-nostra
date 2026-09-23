import {
  getAllExpenses,
  getAllSettlements,
  getCurrentUser,
  getOpenShares,
  getProfiles,
  getFrequentDescriptions,
} from '@/lib/queries'
import { contributionsById } from '@/lib/spending'
import { StoricoShell } from './StoricoShell'

export default async function SpesePage() {
  const [expenses, user, profiles, suggestions, openShares, settlements] = await Promise.all([
    getAllExpenses(),
    getCurrentUser(),
    getProfiles(),
    getFrequentDescriptions(5),
    getOpenShares(),
    getAllSettlements(),
  ])

  if (!user) return null

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="font-display text-3xl font-semibold text-foreground">Storico spese</h1>

      <StoricoShell
        expenses={expenses}
        settlements={settlements}
        contributions={contributionsById(expenses, openShares, user.id)}
        profiles={profiles}
        currentUserId={user.id}
        suggestions={suggestions}
      />
    </div>
  )
}
