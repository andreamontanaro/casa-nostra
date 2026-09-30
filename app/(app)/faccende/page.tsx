import { shiftDay } from '@/lib/chores/bottle'
import { todayISO } from '@/lib/fmt'
import {
  getChoreBalance,
  getChoreEntriesSince,
  getCurrentUser,
  getFrequentChoreNames,
} from '@/lib/queries'
import { FaccendeShell } from './FaccendeShell'

/** Quanti giorni indietro mostra "Giorni scorsi", oggi escluso. */
const HISTORY_DAYS = 7

export default async function FaccendePage() {
  const today = todayISO()
  const [user, balances, entries, suggestions] = await Promise.all([
    getCurrentUser(),
    getChoreBalance(),
    getChoreEntriesSince(shiftDay(today, -HISTORY_DAYS)),
    getFrequentChoreNames(),
  ])

  return (
    <FaccendeShell
      viewerId={user?.id ?? ''}
      today={today}
      balances={balances}
      entries={entries}
      suggestions={suggestions}
    />
  )
}
