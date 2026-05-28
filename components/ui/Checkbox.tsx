'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: React.Ref<HTMLInputElement>
}

export function Checkbox({ ref, className, ...props }: CheckboxProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'peer h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md border-2 border-border bg-surface',
          'transition-colors',
          'checked:border-accent checked:bg-accent',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <Check
        className="pointer-events-none absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-accent-foreground opacity-0 peer-checked:opacity-100"
        strokeWidth={3.5}
        aria-hidden
      />
    </span>
  )
}
