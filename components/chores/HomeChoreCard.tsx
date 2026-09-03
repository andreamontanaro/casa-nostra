'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Card } from '@/components/ui/Card'
import { ChoreRow } from '@/components/chores/ChoreRow'
import { completeChore, undoChoreLog } from '@/app/actions/chores'
import { toast } from '@/lib/toast'
import { formatChoreRecency } from '@/lib/fmt'
import type { ChoreStatusRow } from '@/lib/queries'

interface HomeChoreCardProps {
  rows: ChoreStatusRow[]
}

/**
 * Card compatta in home con le faccende più urgenti e il tap "Fatto"
 * diretto: è il percorso che rende realistico il criterio dei 5 secondi
 * (docs/design-modulo-gestione-casa.md § 6), perché la home è la schermata
 * che si apre.
 */
export function HomeChoreCard({ rows }: HomeChoreCardProps) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const visible = rows.filter((r) => r.id && !hiddenIds.has(r.id))
  if (visible.length === 0) return null

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
    setHiddenIds((prev) => new Set(prev).add(id))
    toast.success('Registrato.', {
      action: {
        label: 'Annulla',
        onClick: async () => {
          await undoChoreLog(logId)
          setHiddenIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        },
      },
    })
  }

  return (
    // .chore-arena locale (solo variabili --accent-*, niente sfondo): la card
    // "sbuca" con i colori del modulo Casa in mezzo alla home teal, come
    // primo indizio — prima ancora di aprire "/casa" — che è un modulo a sé.
    <section className="chore-arena">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="inline-flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-muted">
          🎮 Da fare in casa
        </h2>
        <Link href="/casa" className="text-sm font-semibold text-accent">
          Vedi tutte
        </Link>
      </div>
      <Card className="divide-y divide-border overflow-hidden rounded-3xl border-2 border-accent-muted p-0">
        <AnimatePresence initial={false}>
          {visible.map((row) => (
            <motion.div key={row.id} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
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
      </Card>
    </section>
  )
}
