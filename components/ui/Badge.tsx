const variants = {
  default: 'bg-surface-raised text-foreground border border-border',
  accent: 'bg-accent-muted text-accent',
  success: 'bg-accent-muted text-accent',
  destructive: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  muted: 'bg-surface-raised text-muted',
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
