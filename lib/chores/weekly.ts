import { KUDOS_XP } from '@/lib/chores/config'
import type { Tables } from '@/types/database'

export type ChoreWeekRow = Tables<'v_chore_week'>
export type ChoreKudosWeekRow = Tables<'v_chore_kudos_week'>
export type ChoreWeekAreaRow = Tables<'v_chore_week_area'>

export interface AreaBreakdownEntry {
  area: string
  choreCount: number
  xp: number
}

/**
 * Faccende per area nella settimana `weekStart`, ordinate per conteggio
 * decrescente. Riepilogo di casa, non un confronto: le righe di
 * `v_chore_week_area` non hanno già una suddivisione per utente, quindi
 * non c'è nulla da poter attribuire all'uno o all'altro qui.
 */
export function summarizeWeekAreas(
  rows: ChoreWeekAreaRow[],
  weekStart: string,
): AreaBreakdownEntry[] {
  return rows
    .filter((r) => r.week_start === weekStart && r.area)
    .map((r) => ({ area: r.area as string, choreCount: r.chore_count ?? 0, xp: r.xp ?? 0 }))
    .sort((a, b) => b.choreCount - a.choreCount)
}

export interface WeekSummary {
  weekStart: string
  /** XP delle faccende, entrambi gli utenti insieme — mai spezzato per persona. */
  choreXp: number
  /** XP dei kudos di quella settimana (non attribuiti a nessuno). */
  kudosXp: number
  /** choreXp + kudosXp: quello che conta per l'obiettivo settimanale. */
  totalXp: number
}

/**
 * Aggrega le righe di `v_chore_week` (una per utente per settimana) e di
 * `v_chore_kudos_week` in un riepilogo per settimana. Pura funzione di
 * riduzione: le viste fanno già tutto il calcolo pesante sul DB, qui si
 * limita a raggruppare righe che arrivano già corrette.
 */
export function summarizeWeeks(
  choreRows: ChoreWeekRow[],
  kudosRows: ChoreKudosWeekRow[],
): Map<string, WeekSummary> {
  const byWeek = new Map<string, WeekSummary>()

  function ensure(weekStart: string): WeekSummary {
    let s = byWeek.get(weekStart)
    if (!s) {
      s = { weekStart, choreXp: 0, kudosXp: 0, totalXp: 0 }
      byWeek.set(weekStart, s)
    }
    return s
  }

  for (const row of choreRows) {
    if (!row.week_start || !row.user_id) continue
    const s = ensure(row.week_start)
    const xp = row.xp ?? 0
    s.choreXp += xp
    s.totalXp += xp
  }

  for (const row of kudosRows) {
    if (!row.week_start) continue
    const s = ensure(row.week_start)
    const kudosXp = (row.kudos_count ?? 0) * KUDOS_XP
    s.kudosXp += kudosXp
    s.totalXp += kudosXp
  }

  return byWeek
}

/**
 * Quante tacche della bottiglia settimanale sono piene: soglie regolari di
 * `goalXp / maxNotches`, arrotondate per difetto. Bottiglia di casa (stesso
 * `totalXp` che alimenta obiettivo e striscia), non una a testa — si azzera
 * da sola a ogni nuova settimana perché `totalXp` è già scoped alla
 * settimana corrente (vedi `summarizeWeeks`).
 */
export function computeFilledNotches(totalXp: number, goalXp: number, maxNotches = 5): number {
  if (goalXp <= 0) return 0
  return Math.min(maxNotches, Math.floor((totalXp / goalXp) * maxNotches))
}

/** Sposta una data 'YYYY-MM-DD' di N settimane (aritmetica pura su date UTC). */
export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Settimane consecutive, andando indietro dalla settimana corrente, con XP
 * totale >= obiettivo. Conta solo settimane già CONCLUSE: la settimana in
 * corso è ancora aperta, e farla pesare sulla striscia prima che finisca
 * la farebbe scendere e risalire nel corso della settimana — scoraggiante
 * senza motivo. Il progresso della settimana in corso si mostra a parte.
 */
export function computeStreak(
  weeks: Map<string, WeekSummary>,
  currentWeekStart: string,
  goalXp: number,
): number {
  let streak = 0
  let cursor = shiftWeek(currentWeekStart, -1)
  while (true) {
    const s = weeks.get(cursor)
    if (!s || s.totalXp < goalXp) break
    streak += 1
    cursor = shiftWeek(cursor, -1)
  }
  return streak
}
