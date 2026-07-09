import {
  getAllExpenses,
  getCurrentUser,
  getProfiles,
  getFrequentDescriptions,
} from '@/lib/queries'
import { StoricoShell } from './StoricoShell'

export default async function SpesePage() {
  const [expenses, user, profiles, suggestions] = await Promise.all([
    getAllExpenses(),
    getCurrentUser(),
    getProfiles(),
    getFrequentDescriptions(5),
  ])

  if (!user) return null

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-foreground">Storico spese</h1>

      <StoricoShell
        expenses={expenses}
        profiles={profiles}
        currentUserId={user.id}
        suggestions={suggestions}
      />
    </div>
  )
}
