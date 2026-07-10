import { formatEur } from '@/lib/fmt'
import { cn } from '@/lib/utils'

type AmountSize = 'display' | 'display-sm' | 'title'
type AmountTone = 'neutral' | 'positive' | 'negative'

const sizeClass: Record<AmountSize, string> = {
  display: 'text-display font-extrabold tracking-[-0.03em]',
  'display-sm': 'text-display-sm font-bold tracking-[-0.02em]',
  title: 'text-title font-semibold tracking-[-0.01em]',
}

const toneClass: Record<AmountTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-destructive',
}

interface AmountDisplayProps {
  value: number
  size?: AmountSize
  tone?: AmountTone
  // Antepone esplicitamente il segno (+/−); di default mostra il valore così com'è.
  showSign?: boolean
  className?: string
}

export function AmountDisplay({
  value,
  size = 'display',
  tone = 'neutral',
  showSign = false,
  className,
}: AmountDisplayProps) {
  const sign = showSign && value > 0 ? '+' : ''
  return (
    <span
      className={cn('tabular-nums', sizeClass[size], toneClass[tone], className)}
    >
      {sign}
      {formatEur(value)}
    </span>
  )
}
