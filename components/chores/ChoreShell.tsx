'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, ChevronDown } from 'lucide-react'
import { ChoreRow } from '@/components/chores/ChoreRow'
import { ChoreLogRow } from '@/components/chores/ChoreLogRow'
import { ChoreWelcomeHeader } from '@/components/chores/ChoreWelcomeHeader'
import { RegisterChoreSheet } from '@/components/chores/RegisterChoreSheet'
import { WeekGoalCard } from '@/components/chores/WeekGoalCard'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { springSnappy, springSoft } from '@/lib/motion'
import { completeChore, undoChoreLog, setChoreKudos, removeChoreKudos } from '@/app/actions/chores'
import { toast } from '@/lib/toast'
import {
  formatChoreRecency,
  formatChoreDayLabel,
  formatDateShort,
  romeDateKey,
  CHORE_AREA_ICON,
  CHORE_AREA_LABELS,
} from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type {
  ChoreStatusRow,
  ChoreLog,
  ChoreWeekRow,
  ChoreKudosWeekRow,
  ChoreWeekAreaRow,
} from '@/lib/queries'
import type { Tables } from '@/types/database'

type Profile = Tables<'profiles'>

interface OptimisticLog {
  id: string
  title: string
  area: string
  xp: number
  doneByName: string
  __optimistic: true
}

type FeedEntry = ChoreLog | OptimisticLog

interface ChoreShellProps {
  currentUserId: string
  currentUserDisplayName: string
  statusRows: ChoreStatusRow[]
  recentLogs: ChoreLog[]
  profiles: Profile[]
  weekRows: ChoreWeekRow[]
  kudosWeekRows: ChoreKudosWeekRow[]
  weekAreaRows: ChoreWeekAreaRow[]
  currentWeekStart: string
}

/**
 * Raggruppa per chiave, preservando l'ordine di prima comparsa di ogni
 * gruppo e l'ordine relativo degli elementi al suo interno. Usata per "Da
 * fare" (per area: gli elementi sono ordinati per urgenza, non per area, e
 * la stessa area può ricomparire più volte nella lista se non raggruppata
 * esplicitamente) e per il feed (per giorno: lì è già un raggruppamento
 * "gratuito", perché i log arrivano già ordinati per data decrescente).
 */
function groupByKey<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
  const order: string[] = []
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(item)
  }
  return order.map((key) => [key, map.get(key)!])
}

/**
 * Schermata "Da fare" + "Gesti" + "Fatto di recente". Un tap su "Fatto"
 * registra subito con UI ottimistica (stessa logica di HomeShell per le
 * spese): la riga sparisce dalla lista e ricompare nel feed prima che la
 * Server Action risponda, con un toast "Annulla" per rimediare a un tap
 * sbagliato. Nessun dialog di conferma: non è un'azione distruttiva.
 */
export function ChoreShell({
  currentUserId,
  currentUserDisplayName,
  statusRows,
  recentLogs,
  profiles,
  weekRows,
  kudosWeekRows,
  weekAreaRows,
  currentWeekStart,
}: ChoreShellProps) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [optimisticLogs, setOptimisticLogs] = useState<OptimisticLog[]>([])
  const [optimisticBaseKey, setOptimisticBaseKey] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

  const [deletingLogIds, setDeletingLogIds] = useState<Set<string>>(new Set())
  const [kudosPendingIds, setKudosPendingIds] = useState<Set<string>>(new Set())
  const [kudosOverrides, setKudosOverrides] = useState<Map<string, string | null>>(new Map())
  const [kudosOverrideBaseKey, setKudosOverrideBaseKey] = useState('')

  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set())
  const [areaFilter, setAreaFilter] = useState<string>('tutte')

  function toggleAreaCollapsed(area: string) {
    setCollapsedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      return next
    })
  }

  const statusKey = statusRows.map((r) => `${r.id}:${r.last_done_at}`).join('|')
  const stale = optimisticBaseKey !== statusKey
  const visibleHidden = stale ? new Set<string>() : hiddenIds
  const visibleOptimisticLogs = stale ? [] : optimisticLogs

  const recurring = statusRows.filter(
    (r) => r.id && r.cadence_days !== null && !visibleHidden.has(r.id),
  )
  const gesti = statusRows.filter(
    (r) => r.id && r.cadence_days === null && !visibleHidden.has(r.id),
  )
  const combinedLogs = [...visibleOptimisticLogs, ...recentLogs].slice(0, 15)

  const recurringByArea = groupByKey(recurring, (r) => r.area ?? 'altro')
  const areaFilterOptions = recurringByArea.map(([area]) => area)
  const visibleAreaGroups =
    areaFilter === 'tutte'
      ? recurringByArea
      : recurringByArea.filter(([area]) => area === areaFilter)
  const todayKey = romeDateKey(new Date().toISOString())
  const logsByDay = groupByKey(combinedLogs, (log) =>
    '__optimistic' in log ? todayKey : romeDateKey(log.done_at),
  )

  const recentLogsKey = recentLogs
    .map((l) => `${l.id}:${l.kudos.map((k) => k.from_user_id + k.emoji).join(',')}`)
    .join('|')
  const activeKudosOverrides = kudosOverrideBaseKey === recentLogsKey ? kudosOverrides : new Map()

  async function handleDeleteLog(logId: string) {
    setDeletingLogIds((prev) => new Set(prev).add(logId))
    const result = await undoChoreLog(logId)
    setDeletingLogIds((prev) => {
      const next = new Set(prev)
      next.delete(logId)
      return next
    })
    if (result.error) toast.error(result.error)
    else toast.success('Registrazione eliminata.')
  }

  async function handleToggleKudos(log: ChoreLog, emoji: string) {
    const current = activeKudosOverrides.has(log.id)
      ? activeKudosOverrides.get(log.id)!
      : (log.kudos.find((k) => k.from_user_id === currentUserId)?.emoji ?? null)
    const next = current === emoji ? null : emoji

    setKudosOverrideBaseKey(recentLogsKey)
    setKudosOverrides((prev) => new Map(prev).set(log.id, next))
    setKudosPendingIds((prev) => new Set(prev).add(log.id))

    const result = next === null ? await removeChoreKudos(log.id) : await setChoreKudos(log.id, next)

    setKudosPendingIds((prev) => {
      const nextSet = new Set(prev)
      nextSet.delete(log.id)
      return nextSet
    })
    if (result.error) {
      toast.error(result.error)
      setKudosOverrides((prev) => {
        const rollback = new Map(prev)
        rollback.delete(log.id)
        return rollback
      })
    }
  }

  async function handleComplete(row: ChoreStatusRow) {
    const id = row.id
    if (!id) return
    setPendingIds((prev) => new Set(prev).add(id))
    const result = await completeChore(id)
    setPendingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    if (result.error || !result.logId) {
      toast.error(result.error ?? 'Errore durante il salvataggio.')
      return
    }

    const logId = result.logId
    setOptimisticBaseKey(statusKey)
    setHiddenIds((prev) => new Set(prev).add(id))
    setOptimisticLogs((prev) => [
      {
        id: logId,
        title: row.name ?? '',
        area: row.area ?? 'altro',
        xp: row.effort_xp ?? 0,
        doneByName: currentUserDisplayName,
        __optimistic: true,
      },
      ...prev,
    ])

    toast.success('Registrato.', {
      action: {
        label: 'Annulla',
        onClick: async () => {
          await undoChoreLog(logId)
          setOptimisticLogs((prev) => prev.filter((l) => l.id !== logId))
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      },
    })
  }

  function handleSheetRegistered() {
    // La sheet ha già registrato lato server; la revalidazione della rotta
    // porterà i dati freschi. Nessuno stato ottimistico da gestire qui: la
    // faccenda scelta nella sheet può essere una qualsiasi del catalogo, non
    // necessariamente quella in cima alla lista "Da fare".
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-24">
      <ChoreWelcomeHeader displayName={currentUserDisplayName} />

      <WeekGoalCard
        currentUserId={currentUserId}
        profiles={profiles}
        weekRows={weekRows}
        kudosWeekRows={kudosWeekRows}
        weekAreaRows={weekAreaRows}
        currentWeekStart={currentWeekStart}
      />

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-label font-semibold uppercase tracking-wide text-muted">
            Da fare
          </h2>
        </div>

        {areaFilterOptions.length > 1 && (
          <div
            className="-mx-4 mb-3 overflow-x-auto no-scrollbar"
            style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
          >
            <div className="flex items-center gap-2 px-4">
              <Chip variant="filter" active={areaFilter === 'tutte'} onClick={() => setAreaFilter('tutte')}>
                Tutte
              </Chip>
              {areaFilterOptions.map((area) => (
                <Chip
                  key={area}
                  variant="filter"
                  active={areaFilter === area}
                  onClick={() => setAreaFilter(area)}
                >
                  {CHORE_AREA_ICON[area] ?? '✨'} {CHORE_AREA_LABELS[area] ?? area}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {recurring.length === 0 ? (
          <Card>
            <p className="px-4 py-8 text-center text-sm text-muted">Tutto fatto, per ora.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAreaGroups.map(([area, rows]) => {
              const collapsed = collapsedAreas.has(area)
              return (
                <Card key={area} className="overflow-hidden p-0">
                  <button
                    type="button"
                    onClick={() => toggleAreaCollapsed(area)}
                    aria-expanded={!collapsed}
                    className="flex w-full items-center gap-2 border-b border-border bg-surface-sunken/60 px-4 py-2 text-left"
                  >
                    <span aria-hidden>{CHORE_AREA_ICON[area] ?? '✨'}</span>
                    <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
                      {CHORE_AREA_LABELS[area] ?? area}
                    </span>
                    <span className="text-xs text-muted">{rows.length}</span>
                    <motion.span
                      animate={{ rotate: collapsed ? -90 : 0 }}
                      transition={springSnappy}
                      className="text-muted"
                    >
                      <ChevronDown className="size-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={springSoft}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-border">
                          <AnimatePresence initial={false}>
                            {rows.map((row) => (
                              <motion.div
                                key={row.id}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChoreRow
                                  area={row.area ?? 'altro'}
                                  title={row.name ?? ''}
                                  subtitle={
                                    row.last_done_by_name
                                      ? `${formatChoreRecency(row.days_since)} · ${row.last_done_by_name}`
                                      : formatChoreRecency(row.days_since)
                                  }
                                  xp={row.effort_xp ?? 0}
                                  onComplete={() => handleComplete(row)}
                                  pending={pendingIds.has(row.id!)}
                                />
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {gesti.length > 0 && (
        <section>
          <h2 className="mb-3 px-1 text-label font-semibold uppercase tracking-wide text-muted">
            Gesti
          </h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {gesti.map((row) => (
              <ChoreRow
                key={row.id}
                area={row.area ?? 'altro'}
                title={row.name ?? ''}
                subtitle={
                  row.last_done_by_name
                    ? `${formatChoreRecency(row.days_since)} · ${row.last_done_by_name}`
                    : 'Mai registrato'
                }
                xp={row.effort_xp ?? 0}
                onComplete={() => handleComplete(row)}
                pending={pendingIds.has(row.id!)}
              />
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 px-1 text-label font-semibold uppercase tracking-wide text-muted">
          Fatto di recente
        </h2>
        {combinedLogs.length === 0 ? (
          <Card>
            <p className="px-4 py-8 text-center text-sm text-muted">
              Ancora nessuna faccenda registrata.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {logsByDay.map(([dayKey, logs]) => (
              <div key={dayKey}>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {formatChoreDayLabel(dayKey)}
                </p>
                <Card className="divide-y divide-border overflow-hidden p-0">
                  <AnimatePresence initial={false}>
                    {logs.map((log: FeedEntry) => {
                      const isOpt = '__optimistic' in log
                      const myKudosEmoji = isOpt
                        ? null
                        : activeKudosOverrides.has(log.id)
                          ? activeKudosOverrides.get(log.id)!
                          : (log.kudos.find((k) => k.from_user_id === currentUserId)?.emoji ?? null)
                      const doneByMe = isOpt || log.done_by === currentUserId

                      return (
                        <motion.div
                          key={log.id}
                          initial={isOpt ? { opacity: 0, y: -8 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChoreLogRow
                            area={log.area}
                            title={log.title}
                            xp={log.xp}
                            doneByName={
                              isOpt ? log.doneByName : (log.done_by_profile?.display_name ?? '—')
                            }
                            doneByMe={doneByMe}
                            whenLabel={isOpt ? 'ora' : formatDateShort(log.done_at)}
                            interactive={!isOpt}
                            canReact={!isOpt && log.done_by !== currentUserId}
                            myKudosEmoji={myKudosEmoji}
                            onToggleKudos={(emoji) => !isOpt && handleToggleKudos(log, emoji)}
                            kudosPending={!isOpt && kudosPendingIds.has(log.id)}
                            canDelete={
                              !isOpt &&
                              (log.done_by === currentUserId || log.created_by === currentUserId)
                            }
                            onDelete={() => handleDeleteLog(log.id)}
                            deletePending={!isOpt && deletingLogIds.has(log.id)}
                          />
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      <motion.button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Registra una faccenda"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springSnappy, delay: 0.1 }}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30',
          'flex size-14 items-center justify-center rounded-full',
          'bg-accent text-accent-foreground shadow-fab',
        )}
      >
        <Plus className="size-6" strokeWidth={2.5} />
      </motion.button>

      <RegisterChoreSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        templates={statusRows}
        onRegistered={handleSheetRegistered}
      />
    </div>
  )
}
