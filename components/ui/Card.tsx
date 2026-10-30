import { cn } from '@/lib/utils'

type CardTone = 'default' | 'raised' | 'sunken'

const toneClass: Record<CardTone, string> = {
  default: 'bg-surface',
  raised: 'bg-surface-raised',
  sunken: 'bg-surface-sunken',
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
  // Superficie della card. `raised`/`sunken` sostituiscono i vari
  // `bg-surface/86 backdrop-blur` sparsi: le card ora sono opache.
  // Dentro un foglio o un dialogo, che sono già `bg-surface`, serve `raised`.
  tone?: CardTone
}

export function Card({
  ref,
  tone = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        // Pulita, come i pannelli della home (dal 30 ottobre 2026): niente
        // bordo né ombra, si stacca dallo sfondo solo con la superficie.
        'rounded-3xl',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 pt-4 pb-2', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 pb-4 pt-2', className)} {...props}>
      {children}
    </div>
  )
}
