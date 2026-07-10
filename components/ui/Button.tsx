'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 font-medium',
    'transition-[transform,background-color,border-color,color] duration-150',
    'active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    'select-none',
  ].join(' '),
  {
    variants: {
      // Hover via color-mix (scurisce/tinge il fill) invece dell'opacity, che sul
      // nuovo look piatto risultava slavata.
      variant: {
        primary:
          'bg-accent text-accent-foreground hover:[background-color:color-mix(in_oklab,var(--accent),#000_8%)] active:[background-color:color-mix(in_oklab,var(--accent),#000_14%)]',
        secondary:
          'bg-accent-muted text-accent-soft hover:[background-color:color-mix(in_oklab,var(--accent-muted),var(--accent)_10%)]',
        outline:
          'border border-border-strong bg-transparent text-foreground hover:bg-surface-raised active:bg-border',
        ghost: 'text-foreground hover:bg-surface-raised active:bg-border',
        destructive:
          'bg-destructive text-destructive-foreground hover:[background-color:color-mix(in_oklab,var(--destructive),#000_8%)] active:[background-color:color-mix(in_oklab,var(--destructive),#000_14%)]',
      },
      size: {
        sm: 'h-9 px-4 text-sm rounded-full',
        md: 'h-11 px-5 text-base rounded-full',
        lg: 'h-13 px-6 text-base font-semibold rounded-full',
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
