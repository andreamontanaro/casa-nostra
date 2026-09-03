import { CHORE_AREA_ICON } from '@/lib/fmt'
import { choreAreaGradient } from '@/lib/chores/areaTheme'
import { cn } from '@/lib/utils'

type ChoreIconSize = 'sm' | 'md' | 'lg'

const sizeClass: Record<ChoreIconSize, string> = {
  sm: 'size-8 text-base rounded-xl',
  md: 'size-10 text-lg rounded-2xl',
  lg: 'size-14 text-2xl rounded-2xl',
}

interface ChoreIconProps {
  area: string
  size?: ChoreIconSize
  className?: string
}

/**
 * Tile a gradiente pieno per area (lib/chores/areaTheme.ts) invece della
 * tinta tenue al 15% delle icone spese: nel modulo Casa le icone sono
 * "adesivi" colorati, non pittogrammi neutri — è il primo segnale visivo
 * che si è in un modulo diverso.
 */
export function ChoreIcon({ area, size = 'md', className }: ChoreIconProps) {
  const emoji = CHORE_AREA_ICON[area] ?? '✨'

  return (
    <span
      aria-hidden
      style={{ backgroundImage: choreAreaGradient(area) }}
      className={cn(
        'flex shrink-0 items-center justify-center leading-none shadow-sm',
        sizeClass[size],
        className,
      )}
    >
      {emoji}
    </span>
  )
}
