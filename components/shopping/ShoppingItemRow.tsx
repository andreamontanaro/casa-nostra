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
  const details = [quantity, note].filter(Boolean).join(' · ')

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
        disabled={!onEdit}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left',
          onEdit && 'transition-colors hover:opacity-80',
        )}
      >
        {!bought && <ShoppingIcon category={category} size="sm" />}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-sm font-medium',
              bought ? 'text-muted line-through' : 'text-foreground',
            )}
          >
            {name}
          </span>
          {(details || subtitle) && (
            <span className="mt-0.5 block truncate text-xs text-muted">
              {details}
              {details && subtitle ? ' · ' : ''}
              {subtitle}
            </span>
          )}
        </span>
      </button>

      {!bought && urgency === 'alta' && (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            SHOPPING_URGENCY_CLASS[urgency],
          )}
        >
          {SHOPPING_URGENCY_SHORT[urgency]}
        </span>
      )}

      {pending && <Spinner size="sm" />}

      {onRestore && (
        <button
          type="button"
          onClick={onRestore}
          aria-label={`Rimetti "${name}" in lista`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
        >
          <RotateCcw className="size-4" />
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Elimina "${name}"`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-raised hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </motion.div>
  )
}
