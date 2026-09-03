'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Flame, PartyPopper } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useGamificationEnabled } from '@/lib/chores/gamification'
import { WEEKLY_GOAL_XP } from '@/lib/chores/config'
import { summarizeWeeks, summarizeWeekAreas, computeStreak, computeBalance } from '@/lib/chores/weekly'
import { springSnappy, springSoft } from '@/lib/motion'
import { CHORE_AREA_ICON, CHORE_AREA_LABELS } from '@/lib/fmt'
import type { ChoreWeekRow, ChoreKudosWeekRow, ChoreWeekAreaRow } from '@/lib/queries'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

interface WeekGoalCardProps {
  currentUserId: string
  profiles: Profile[]
  weekRows: ChoreWeekRow[]
  kudosWeekRows: ChoreKudosWeekRow[]
  weekAreaRows: ChoreWeekAreaRow[]
  currentWeekStart: string
}

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '—'
}

/**
 * Card "La nostra settimana": obiettivo XP di casa, striscia, riepilogo per
 * area e barra di equilibrio. Il numero grande è quello della casa, non
 * della persona (principio 1 del design) — la ripartizione individuale c'è
 * ma non è mai l'eroe della pagina, e resta muta finché non esce dalla zona
 * morta. Nascondibile dall'interruttore "gamification" nelle impostazioni.
 */
export function WeekGoalCard({
  currentUserId,
  profiles,
  weekRows,
  kudosWeekRows,
  weekAreaRows,
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
  const areaBreakdown = summarizeWeekAreas(weekAreaRows, currentWeekStart).slice(0, 5)

  const reachedThisWeek = current.totalXp >= WEEKLY_GOAL_XP
  const pastStreak = computeStreak(weeks, currentWeekStart, WEEKLY_GOAL_XP)
  const streak = reachedThisWeek ? pastStreak + 1 : pastStreak
  const progressPercent = Math.min(100, Math.round((current.totalXp / WEEKLY_GOAL_XP) * 100))

  const balance = computeBalance(current.choreXpByUser, currentUserId, other.id)
  const leaderName =
    balance.leaderUserId === currentUserId ? 'Tu hai' : `${firstName(other.display_name)} ha`

  return (
    <Card className="overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <p className="text-label font-medium uppercase tracking-wider text-muted">
          La nostra settimana
        </p>
        <AnimatePresence>
          {streak > 0 && (
            <motion.span
              key={streak}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={springSnappy}
              className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-xs font-semibold text-accent-soft"
            >
              <Flame className="size-3.5" strokeWidth={2.5} />
              {streak}ª settimana di fila
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2">
        <p className="text-display-sm font-bold tracking-[-0.02em] text-foreground">
          {current.totalXp} <span className="text-base font-medium text-muted">/ {WEEKLY_GOAL_XP} XP</span>
        </p>
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={springSoft}
        />
      </div>

      <AnimatePresence>
        {reachedThisWeek && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={springSoft}
            className="flex items-center gap-2 overflow-hidden rounded-2xl bg-positive-muted px-3 py-2 text-sm font-medium text-positive-soft"
          >
            <PartyPopper className="size-4 shrink-0" strokeWidth={2.2} />
            Obiettivo della settimana raggiunto!
          </motion.div>
        )}
      </AnimatePresence>

      {areaBreakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {areaBreakdown.map((entry) => (
            <span
              key={entry.area}
              className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-muted"
            >
              <span aria-hidden>{CHORE_AREA_ICON[entry.area] ?? '✨'}</span>
              {CHORE_AREA_LABELS[entry.area] ?? entry.area}
              <span className="font-semibold text-foreground">{entry.choreCount}</span>
            </span>
          ))}
        </div>
      )}

      {/* Barra di equilibrio: zona morta ampia, nessun verdetto sulle settimane normali. */}
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-strong">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${balance.primaryPercent}%` }}
            transition={springSoft}
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
