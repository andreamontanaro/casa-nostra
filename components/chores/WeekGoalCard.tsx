'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Flame, PartyPopper, Target } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CelebrationBurst } from '@/components/chores/CelebrationBurst'
import { useGamificationEnabled } from '@/lib/chores/gamification'
import { WEEKLY_GOAL_XP } from '@/lib/chores/config'
import { summarizeWeeks, summarizeWeekAreas, computeStreak, computeBalance } from '@/lib/chores/weekly'
import { springSnappy, springSoft } from '@/lib/motion'
import { CHORE_AREA_ICON, CHORE_AREA_LABELS } from '@/lib/fmt'
import { choreAreaSolid } from '@/lib/chores/areaTheme'
import { cn } from '@/lib/utils'
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
 * Card "La nostra settimana": un cruscotto da videogioco (livello, barra XP
 * con "shine", striscia che brilla) ma con lo stesso contenuto di sempre — il
 * numero grande è quello della casa, non della persona (principio 1 del
 * design), e la barra di equilibrio resta muta dentro la zona morta, senza
 * percentuali né colori per persona (decisione chiusa #7 del design doc).
 * Solo la cornice diventa gioco: i dati e le regole di tono restano identici.
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
  const [confettiActive, setConfettiActive] = useState(true)
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
    <Card className="relative overflow-hidden rounded-3xl border-2 border-accent-muted p-4">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-label font-semibold uppercase tracking-wider text-accent-soft">
          <Target className="size-3.5" strokeWidth={2.5} />
          La nostra settimana
        </p>
        <AnimatePresence>
          {streak > 0 && (
            <motion.span
              key={streak}
              initial={{ scale: 0, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={springSnappy}
              className="inline-flex items-center gap-1 rounded-full bg-chore-gold-muted px-2.5 py-1 text-xs font-bold text-chore-gold-soft"
            >
              <motion.span
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Flame className="size-3.5" strokeWidth={2.5} fill="currentColor" />
              </motion.span>
              {streak}ª di fila
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <motion.span
          key={current.totalXp}
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={springSnappy}
          className="text-display-sm font-black tracking-[-0.02em] text-foreground"
        >
          {current.totalXp}
        </motion.span>
        <span className="text-base font-semibold text-muted">/ {WEEKLY_GOAL_XP} 🪙</span>
      </div>

      <div className="relative mt-2 h-4 w-full overflow-hidden rounded-full bg-surface-sunken">
        <motion.div
          className={cn(
            'relative h-full overflow-hidden rounded-full bg-gradient-to-r from-accent to-chore-gold',
            progressPercent > 0 && 'chore-shine',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ ...springSoft, bounce: 0.35 }}
        />
      </div>

      <AnimatePresence>
        {reachedThisWeek && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0, scale: 0.9 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={springSnappy}
            className="relative flex items-center gap-2 overflow-visible rounded-2xl bg-positive-muted px-3 py-2 text-sm font-semibold text-positive-soft"
          >
            <PartyPopper className="size-4 shrink-0" strokeWidth={2.2} />
            Obiettivo della settimana raggiunto!
            <div className="absolute inset-0">
              <CelebrationBurst active={confettiActive} onDone={() => setConfettiActive(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {areaBreakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {areaBreakdown.map((entry) => (
            <span
              key={entry.area}
              style={{
                backgroundColor: `color-mix(in oklab, ${choreAreaSolid(entry.area)}, transparent 82%)`,
                color: choreAreaSolid(entry.area),
              }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            >
              <span aria-hidden>{CHORE_AREA_ICON[entry.area] ?? '✨'}</span>
              {CHORE_AREA_LABELS[entry.area] ?? entry.area}
              <span className="font-bold">{entry.choreCount}</span>
            </span>
          ))}
        </div>
      )}

      {/* Barra di equilibrio: zona morta ampia, nessun verdetto sulle settimane
          normali. Stile invariato di proposito (decisione chiusa #7): niente
          colori per persona, niente percentuali fuori dalla zona morta. */}
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
    </Card>
  )
}
