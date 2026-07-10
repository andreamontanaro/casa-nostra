'use client'

import { cn } from '@/lib/utils'

type ChipVariant = 'filter' | 'suggestion'

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // `filter` = chip di filtro selezionabile (stato attivo tonale);
  // `suggestion` = chip d'azione leggera (es. suggerimenti descrizione).
  variant?: ChipVariant
  active?: boolean
}

export function Chip({
  variant = 'filter',
  active = false,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium',
        'transition-[border-color,background-color,color,transform] duration-150',
        'active:scale-[0.97]',
        'disabled:opacity-50 disabled:pointer-events-none',
        variant === 'filter'
          ? active
            ? 'border border-transparent bg-accent text-accent-foreground'
            : 'border border-border-strong bg-transparent text-muted hover:border-accent/50 hover:text-foreground'
          : 'border border-border-strong bg-transparent text-muted hover:border-accent/50 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
