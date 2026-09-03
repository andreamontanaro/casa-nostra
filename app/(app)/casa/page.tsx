import { getChoreStatus, getCurrentUser, getProfiles, getRecentChoreLogs } from '@/lib/queries'
import { ChoreShell } from '@/components/chores/ChoreShell'

export default async function CasaPage() {
  const [user, statusRows, recentLogs, profiles] = await Promise.all([
    getCurrentUser(),
    getChoreStatus(),
    getRecentChoreLogs(15),
    getProfiles(),
  ])

  if (!user) return null

  const currentUserDisplayName =
    profiles.find((p) => p.id === user.id)?.display_name ?? 'Tu'

  return (
    <ChoreShell
      currentUserDisplayName={currentUserDisplayName}
      statusRows={statusRows}
      recentLogs={recentLogs}
    />
  )
}
