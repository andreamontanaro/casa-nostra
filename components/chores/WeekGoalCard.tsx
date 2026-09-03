'use client'

import { Flame } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useGamificationEnabled } from '@/lib/chores/gamification'
import { WEEKLY_GOAL_XP } from '@/lib/chores/config'
import { summarizeWeeks, computeStreak, computeBalance } from '@/lib/chores/weekly'
import type { ChoreWeekRow, ChoreKudosWeekRow } from '@/lib/queries'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

interface WeekGoalCardProps {
  currentUserId: string
  profiles: Profile[]
  weekRows: ChoreWeekRow[]
  kudosWeekRows: ChoreKudosWeekRow[]
  currentWeekStart: string
}

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '—'
}

/**
 * Card "La nostra settimana": obiettivo XP di casa, striscia e barra di
 * equilibrio. Il numero grande è quello della casa, non della persona
 * (principio 1 del design) — la ripartizione individuale c'è ma non è mai
 * l'eroe della pagina, e resta muta finché non esce dalla zona morta.
 * Nascondibile dall'interruttore "gamification" nelle impostazioni.
 */
export function WeekGoalCard({
  currentUserId,
  profiles,
  weekRows,
  kudosWeekRows,
  currentWeekStart,
}: WeekGoalCardProps) {
  const enabled = useGamificationEnabled()
  if (!enabled) return null

  const other = profiles.find((p) => p.id !== currentUserId)
  if (!other) return null

  const weeks = summarizeWeeks(weekRows, kudosWeekRows)
  const current = weeks.get(currentWeekStart) ?? {
    weekStart: currentWeekStart,
    choreXpByUser: {},
    choreXp: 0,
    kudosXp: 0,
    totalXp: 0,
  }

  const reachedThisWeek = current.totalXp >= WEEKLY_GOAL_XP
  const pastStreak = computeStreak(weeks, currentWeekStart, WEEKLY_GOAL_XP)
  const streak = reachedThisWeek ? pastStreak + 1 : pastStreak
  const progressPercent = Math.min(100, Math.round((current.totalXp / WEEKLY_GOAL_XP) * 100))

  const balance = computeBalance(current.choreXpByUser, currentUserId, other.id)
  const leaderName =
    balance.leaderUserId === currentUserId ? 'Tu hai' : `${firstName(other.display_name)} ha`

  return (
    <Card className="p-4">
      <p className="text-label font-medium uppercase tracking-wider text-muted">
        La nostra settimana
      </p>

      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-display-sm font-bold tracking-[-0.02em] text-foreground">
          {current.totalXp} <span className="text-base font-medium text-muted">/ {WEEKLY_GOAL_XP} XP</span>
        </p>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-xs font-semibold text-accent-soft">
            <Flame className="size-3.5" strokeWidth={2.5} />
            {streak}ª settimana di fila
          </span>
        )}
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Barra di equilibrio: zona morta ampia, nessun verdetto sulle settimane normali. */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-strong">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${balance.primaryPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {balance.inDeadBand ? 'In equilibrio questa settimana' : `${leaderName} spinto di più questa settimana`}
        </p>
      </div>

      <p className="mt-3 text-xs text-muted/80">Conta i minuti in casa, non le giornate.</p>
    </Card>
  )
}
