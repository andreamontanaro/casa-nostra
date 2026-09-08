'use client'

import { motion } from 'motion/react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { ShoppingIcon } from '@/components/shopping/ShoppingIcon'
import { Checkbox } from '@/components/ui/Checkbox'
import { Spinner } from '@/components/ui/Spinner'
import { SHOPPING_URGENCY_CLASS, SHOPPING_URGENCY_SHORT } from '@/lib/fmt'
import { cn } from '@/lib/utils'

interface ShoppingItemRowProps {
  name: string
  category: string
  quantity?: string | null
  note?: string | null
  urgency?: string
  subtitle?: string
  /** Riga dello storico: nome barrato, niente checkbox. */
  bought?: boolean
  pending?: boolean
  onToggle?: () => void
  onEdit?: () => void
  onRestore?: () => void
  onDelete?: () => void
}

/**
 * Riga della lista: checkbox a sinistra per spuntare in un tap, il resto
 * della riga apre la modifica. Nessuna conferma sullo spunto — si annulla
 * dal toast — mentre l'eliminazione, che non è recuperabile, resta un
 * bottone separato.
 */
export function ShoppingItemRow({
  name,
  category,
  quantity,
  note,
  urgency = 'media',
  subtitle,
  bought = false,
  pending = false,
  onToggle,
  onEdit,
  onRestore,
  onDelete,
}: ShoppingItemRowProps) {
  const details = [note].filter(Boolean).join(' · ')

  return (
    <motion.div
      className="flex w-full items-center gap-1 pr-3"
      animate={pending ? { opacity: 0.5 } : { opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      {bought ? (
        <span className="flex size-11 shrink-0 items-center justify-center">
          <ShoppingIcon category={category} size="sm" />
        </span>
      ) : (
        <Checkbox
          checked={false}
          disabled={pending}
          onChange={() => onToggle?.()}
          aria-label={`Segna "${name}" come comprato`}
        />
      )}

      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit || pending}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left',
          onEdit && 'transition-colors hover:opacity-80',
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block break-words text-base font-semibold',
              bought ? 'text-muted line-through' : 'text-foreground',
            )}
          >
            {name}
          </span>
<span className="mt-1 flex flex-wrap items-center gap-2">
            {quantity && <span className="rounded-lg bg-surface-raised px-2 py-1 text-xs font-semibold text-foreground">{quantity}</span>}
            {!bought && urgency === 'alta' && <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', SHOPPING_URGENCY_CLASS[urgency])}>{SHOPPING_URGENCY_SHORT[urgency]}</span>}
          </span>
          {(details || subtitle) && (
            <span className="mt-1 block text-sm text-muted">
              {details}
              {details && subtitle ? ' · ' : ''}
              {subtitle}
            </span>
          )}
        </span>
      </button>

      {pending && <Spinner size="sm" />}

      {onRestore && (
        <button
          type="button"
          onClick={onRestore}
          disabled={pending}
          aria-label={`Rimetti "${name}" in lista`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Elimina "${name}"`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </motion.div>
  )
}
