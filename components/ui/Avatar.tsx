import { cn } from '@/lib/utils'

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

interface AvatarProps {
  name: string | null | undefined
  /** Tono pieno (accent) invece del bordo neutro — "questo sei tu" o "chi è coinvolto". */
  highlighted?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Cerchio con le iniziali. Estratto da `BalanceCard`, riusato dal feed del modulo faccende. */
export function Avatar({ name, highlighted = false, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs',
        highlighted
          ? 'bg-accent text-accent-foreground'
          : 'border border-border bg-surface text-muted',
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  )
}
