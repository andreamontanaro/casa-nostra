import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ListRowProps {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  // Se `href` è presente rende un Link; altrimenti se `onClick` un button; se
  // nessuno dei due, un semplice contenitore statico.
  href?: string
  onClick?: () => void
  className?: string
}

const base =
  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors'
const interactive = 'hover:bg-surface-raised active:bg-border'

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  className,
}: ListRowProps) {
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn(base, interactive, className)}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, interactive, className)}>
        {content}
      </button>
    )
  }
  return <div className={cn(base, className)}>{content}</div>
}
