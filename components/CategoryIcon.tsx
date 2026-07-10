import { CATEGORY_ICON, CATEGORY_VISUAL } from '@/lib/fmt'
import { cn } from '@/lib/utils'

type CategoryIconSize = 'sm' | 'md' | 'lg'

const sizeClass: Record<CategoryIconSize, string> = {
  sm: 'size-8 text-base rounded-xl',
  md: 'size-10 text-lg rounded-2xl',
  lg: 'size-12 text-2xl rounded-2xl',
}

interface CategoryIconProps {
  category: string
  size?: CategoryIconSize
  className?: string
}

export function CategoryIcon({
  category,
  size = 'md',
  className,
}: CategoryIconProps) {
  const container =
    CATEGORY_VISUAL[category]?.container ?? CATEGORY_VISUAL.altro.container
  const emoji = CATEGORY_ICON[category] ?? '📦'

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
