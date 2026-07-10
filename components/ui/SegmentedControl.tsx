'use client'

import { motion } from 'motion/react'
import { springSnappy } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  // Identificatore univoco: pilota il layoutId della pillola attiva.
  groupId: string
  value: string
  onChange: (value: string) => void
  options: SegmentedOption[]
  className?: string
}

export function SegmentedControl({
  groupId,
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'relative flex rounded-full border border-border bg-surface-sunken p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative flex-1 rounded-full px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-150',
              isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`segctl-${groupId}`}
                transition={springSnappy}
                className="absolute inset-0 -z-10 rounded-full bg-surface shadow-soft"
              />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
