'use client'

import { Spinner } from './Spinner'

const variants = {
  primary: 'bg-accent text-accent-foreground hover:opacity-90 active:opacity-80',
  secondary: 'bg-surface-raised text-foreground border border-border hover:bg-border',
  ghost: 'text-foreground hover:bg-surface-raised active:bg-border',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80',
} as const

const sizes = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-base rounded-xl',
  lg: 'h-12 px-6 text-base font-medium rounded-xl',
} as const

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
}

export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'relative inline-flex items-center justify-center gap-2 font-medium transition-opacity',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      <span className={loading ? 'invisible' : ''}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
      )}
    </button>
  )
}
