import {
  getChoreStatus,
  getCurrentUser,
  getProfiles,
  getRecentChoreLogs,
  getChoreWeekRows,
  getChoreKudosWeekRows,
  getChoreWeekAreaRows,
  getCurrentChoreWeekStart,
} from '@/lib/queries'
import { ChoreShell } from '@/components/chores/ChoreShell'

export default async function CasaPage() {
  const [
    user,
    statusRows,
    recentLogs,
    profiles,
    weekRows,
    kudosWeekRows,
    weekAreaRows,
    currentWeekStart,
  ] = await Promise.all([
    getCurrentUser(),
    getChoreStatus(),
    getRecentChoreLogs(15),
    getProfiles(),
    getChoreWeekRows(),
    getChoreKudosWeekRows(),
    getChoreWeekAreaRows(),
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
      weekAreaRows={weekAreaRows}
      currentWeekStart={currentWeekStart}
    />
  )
}
