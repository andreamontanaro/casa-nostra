import { CHORE_AREA_CONTAINER, CHORE_AREA_ICON } from '@/lib/fmt'
import { cn } from '@/lib/utils'

type ChoreIconSize = 'sm' | 'md' | 'lg'

const sizeClass: Record<ChoreIconSize, string> = {
  sm: 'size-8 text-base rounded-xl',
  md: 'size-10 text-lg rounded-2xl',
  lg: 'size-12 text-2xl rounded-2xl',
}

interface ChoreIconProps {
  area: string
  size?: ChoreIconSize
  className?: string
}

export function ChoreIcon({ area, size = 'md', className }: ChoreIconProps) {
  const container = CHORE_AREA_CONTAINER[area] ?? CHORE_AREA_CONTAINER.altro
  const emoji = CHORE_AREA_ICON[area] ?? '✨'

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center leading-none',
        sizeClass[size],
        container,
        className,
      )}
    >
      {emoji}
    </span>
  )
}
