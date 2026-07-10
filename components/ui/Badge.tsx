const variants = {
  default: 'bg-surface-raised text-foreground border border-border',
  accent: 'bg-accent-muted text-accent-soft',
  success: 'bg-accent-muted text-accent-soft',
  positive: 'bg-positive-muted text-positive-soft',
  destructive: 'bg-destructive/12 text-destructive',
  muted: 'bg-surface-raised text-muted',
  outline: 'border border-border-strong text-muted',
} as const

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
