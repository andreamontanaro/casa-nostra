'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { ChoreRow } from '@/components/chores/ChoreRow'
import { ChoreLogRow } from '@/components/chores/ChoreLogRow'
import { RegisterChoreSheet } from '@/components/chores/RegisterChoreSheet'
import { Card } from '@/components/ui/Card'
import { springSnappy } from '@/lib/motion'
import { completeChore, undoChoreLog } from '@/app/actions/chores'
import { toast } from '@/lib/toast'
import { formatChoreRecency, formatDateShort } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { ChoreStatusRow, ChoreLog } from '@/lib/queries'

interface OptimisticLog {
  id: string
  title: string
  area: string
  doneByName: string
  __optimistic: true
}

interface ChoreShellProps {
  currentUserDisplayName: string
  statusRows: ChoreStatusRow[]
  recentLogs: ChoreLog[]
}

/**
 * Schermata "Da fare" + "Gesti" + "Fatto di recente". Un tap su "Fatto"
 * registra subito con UI ottimistica (stessa logica di HomeShell per le
 * spese): la riga sparisce dalla lista e ricompare nel feed prima che la
 * Server Action risponda, con un toast "Annulla" per rimediare a un tap
 * sbagliato. Nessun dialog di conferma: non è un'azione distruttiva.
 */
export function ChoreShell({
  currentUserDisplayName,
  statusRows,
  recentLogs,
}: ChoreShellProps) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [optimisticLogs, setOptimisticLogs] = useState<OptimisticLog[]>([])
  const [optimisticBaseKey, setOptimisticBaseKey] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)

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
      <section>
        <h2 className="mb-3 px-1 text-label font-semibold uppercase tracking-wide text-muted">
          Da fare
        </h2>
        {recurring.length === 0 ? (
          <Card>
            <p className="px-4 py-8 text-center text-sm text-muted">Tutto fatto, per ora.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            <AnimatePresence initial={false}>
              {recurring.map((row) => (
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
                    onComplete={() => handleComplete(row)}
                    pending={pendingIds.has(row.id!)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
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
          <Card className="divide-y divide-border overflow-hidden p-0">
            <AnimatePresence initial={false}>
              {combinedLogs.map((log) => {
                const isOpt = '__optimistic' in log
                return (
                  <motion.div
                    key={log.id}
                    initial={isOpt ? { opacity: 0, y: -8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChoreLogRow
                      area={log.area}
                      title={log.title}
                      doneByName={
                        isOpt ? log.doneByName : log.done_by_profile?.display_name ?? '—'
                      }
                      whenLabel={isOpt ? 'ora' : formatDateShort(log.done_at)}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </Card>
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
