import {
  getChoreStatus,
  getCurrentUser,
  getProfiles,
  getRecentChoreLogs,
  getChoreWeekRows,
  getChoreKudosWeekRows,
  getCurrentChoreWeekStart,
} from '@/lib/queries'
import { ChoreShell } from '@/components/chores/ChoreShell'

export default async function CasaPage() {
  const [user, statusRows, recentLogs, profiles, weekRows, kudosWeekRows, currentWeekStart] =
    await Promise.all([
      getCurrentUser(),
      getChoreStatus(),
      getRecentChoreLogs(15),
      getProfiles(),
      getChoreWeekRows(),
      getChoreKudosWeekRows(),
      getCurrentChoreWeekStart(),
    ])

  if (!user) return null

  const currentUserDisplayName =
    profiles.find((p) => p.id === user.id)?.display_name ?? 'Tu'

  return (
    <ChoreShell
      currentUserId={user.id}
      currentUserDisplayName={currentUserDisplayName}
      statusRows={statusRows}
      recentLogs={recentLogs}
      profiles={profiles}
      weekRows={weekRows}
      kudosWeekRows={kudosWeekRows}
      currentWeekStart={currentWeekStart}
    />
  )
}
