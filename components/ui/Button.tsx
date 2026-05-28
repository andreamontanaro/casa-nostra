'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 font-medium',
    'transition-[opacity,transform,background-color] duration-150',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    'select-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-foreground shadow-soft hover:opacity-95 active:opacity-90',
        secondary:
          'bg-surface-raised text-foreground border border-border hover:bg-border/60',
        ghost:
          'text-foreground hover:bg-surface-raised active:bg-border',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:opacity-95 active:opacity-90',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-lg',
        md: 'h-11 px-4 text-base rounded-xl',
        lg: 'h-12 px-6 text-base font-semibold rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: React.Ref<HTMLButtonElement>
  loading?: boolean
}

export function Button({
  ref,
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <span className={loading ? 'invisible' : 'inline-flex items-center gap-2'}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
      )}
    </button>
  )
}

export { buttonVariants }
