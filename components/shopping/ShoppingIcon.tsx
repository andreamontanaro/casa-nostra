import { SHOPPING_CATEGORY_ICON } from '@/lib/fmt'
import { cn } from '@/lib/utils'

type ShoppingIconSize = 'sm' | 'md'

const sizeClass: Record<ShoppingIconSize, string> = {
  sm: 'size-8 text-base rounded-xl',
  md: 'size-10 text-lg rounded-2xl',
}

interface ShoppingIconProps {
  category: string
  size?: ShoppingIconSize
  className?: string
}

/**
 * Tondo con l'emoji del tipo di prodotto. Contenitore neutro, non colorato
 * per categoria come nelle spese: qui il colore è riservato all'urgenza, e
 * due scale cromatiche sulla stessa riga si annullerebbero a vicenda.
 */
export function ShoppingIcon({ category, size = 'md', className }: ShoppingIconProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center leading-none bg-surface-sunken',
        sizeClass[size],
        className,
      )}
    >
      {SHOPPING_CATEGORY_ICON[category] ?? '📦'}
    </span>
  )
}
