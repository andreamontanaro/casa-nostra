'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ChoreIcon } from '@/components/ChoreIcon'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { KUDOS_EMOJIS } from '@/lib/chores/config'
import { cn } from '@/lib/utils'

interface ChoreLogRowProps {
  area: string
  title: string
  doneByName: string
  /** true se l'ha fatta l'utente che sta guardando lo schermo. */
  doneByMe: boolean
  whenLabel: string
  /** false per le righe ottimistiche appena inserite: niente kudos/elimina finché non arrivano i dati reali. */
  interactive: boolean
  /** true se posso reagire (non l'ho fatta io: divieto di auto-kudos). */
  canReact: boolean
  myKudosEmoji: string | null
  onToggleKudos: (emoji: string) => void
  kudosPending?: boolean
  /** true se posso eliminare questa registrazione (l'ho fatta o registrata io). */
  canDelete: boolean
  onDelete: () => void
  deletePending?: boolean
}

/** Riga del feed "Fatto di recente": chi ha fatto cosa, quando, kudos ed eliminazione. */
export function ChoreLogRow({
  area,
  title,
  doneByName,
  doneByMe,
  whenLabel,
  interactive,
  canReact,
  myKudosEmoji,
  onToggleKudos,
  kudosPending = false,
  canDelete,
  onDelete,
  deletePending = false,
}: ChoreLogRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <ChoreIcon area={area} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <Avatar name={doneByName} highlighted={doneByMe} size="sm" />
            <span className="truncate">
              {doneByMe ? 'Tu' : doneByName} · {whenLabel}
            </span>
          </div>
        </div>
        {interactive && canDelete && (
          <button
            type="button"
            aria-label="Elimina questa registrazione"
            onClick={() => setConfirmOpen(true)}
            disabled={deletePending}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      {interactive && canReact && (
        <div className="flex items-center gap-1 pl-11">
          {KUDOS_EMOJIS.map((emoji) => {
            const mine = myKudosEmoji === emoji
            return (
              <button
                key={emoji}
                type="button"
                aria-label={`Reagisci con ${emoji}`}
                aria-pressed={mine}
                disabled={kudosPending}
                onClick={() => onToggleKudos(emoji)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-sm transition-colors',
                  mine ? 'bg-accent-muted' : 'hover:bg-surface-raised',
                  'disabled:opacity-50',
                )}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Eliminare questa registrazione?"
        description={`"${title}" verrà rimossa dallo storico. L'operazione non può essere annullata.`}
        confirmLabel="Elimina"
        confirmVariant="destructive"
        onConfirm={() => {
          onDelete()
          setConfirmOpen(false)
        }}
        loading={deletePending}
      />
    </div>
  )
}
