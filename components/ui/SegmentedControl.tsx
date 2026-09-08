'use client'

import { cn } from '@/lib/utils'
export interface SegmentedOption { value: string; label: string }
interface Props {
  groupId: string; value: string; onChange: (value: string) => void
  options: SegmentedOption[]; className?: string; disabled?: boolean; label?: string
}
export function SegmentedControl({ groupId, value, onChange, options, className, disabled, label = 'Scegli un’opzione' }: Props) {
  return <div role="group" aria-label={label} id={groupId} className={cn('flex gap-1 rounded-2xl bg-surface-raised p-1', className)}>
    {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} disabled={disabled}
      onClick={() => onChange(option.value)}
      className={cn('min-h-11 min-w-0 flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        value === option.value ? 'bg-surface text-accent shadow-soft' : 'text-muted hover:text-foreground')}>
      {option.label}
    </button>)}
  </div>
}
