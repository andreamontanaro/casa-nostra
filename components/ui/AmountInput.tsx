'use client'

import { cn } from '@/lib/utils'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  name?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  autoFocus?: boolean
  // `hero` = campo importo protagonista (form amount-first);
  // `md` = campo importo secondario (es. quota personalizzata).
  size?: 'hero' | 'md'
  id?: string
}

export function AmountInput({
  value,
  onChange,
  name = 'amount',
  label,
  placeholder = '0,00',
  disabled = false,
  error,
  autoFocus = false,
  size = 'hero',
  id,
}: AmountInputProps) {
  const isHero = size === 'hero'
  const inputId = id ?? name

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label font-medium text-muted">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-150',
          'focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent',
          error ? 'border-destructive' : 'border-border',
          isHero ? 'h-20 gap-2 px-5 justify-center' : 'h-12 gap-1.5 px-4',
          disabled && 'opacity-50',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'font-semibold text-muted tabular-nums',
            isHero ? 'text-display-sm' : 'text-xl',
          )}
        >
          €
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className={cn(
            'min-w-0 bg-transparent font-bold text-foreground tabular-nums',
            'placeholder:font-medium placeholder:text-muted/50',
            'focus:outline-none',
            isHero
              ? 'w-full max-w-[7ch] text-display-sm tracking-[-0.02em] text-center'
              : 'flex-1 text-xl',
          )}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
