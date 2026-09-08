import { House, Zap, ShoppingBasket, Tv, Wrench, Plane, Package, type LucideIcon } from 'lucide-react'
import { CATEGORY_VISUAL } from '@/lib/fmt'
import { cn } from '@/lib/utils'
const ICONS: Record<string, LucideIcon> = { affitto: House, bolletta: Zap, spesa_alimentare: ShoppingBasket, abbonamento: Tv, manutenzione: Wrench, viaggi: Plane, altro: Package }
const sizes = { sm: 'size-8 rounded-xl [&>svg]:size-4', md: 'size-10 rounded-2xl [&>svg]:size-5', lg: 'size-12 rounded-2xl [&>svg]:size-6' }
export function CategoryIcon({ category, size = 'md', className }: { category: string; size?: keyof typeof sizes; className?: string }) {
  const Icon = ICONS[category] ?? Package
  const container = CATEGORY_VISUAL[category]?.container ?? CATEGORY_VISUAL.altro.container
  return <span aria-hidden className={cn('flex shrink-0 items-center justify-center text-foreground', sizes[size], container, className)}><Icon strokeWidth={1.8} /></span>
}
