'use client'

import type { BottleView } from '@/lib/chores/bottle-view'
import { cn } from '@/lib/utils'

interface BottleViewToggleProps {
  view: BottleView
  onChange: (view: BottleView) => void
  /** Avvicinarsi al 3D (dito, mouse, tastiera) basta per iniziare a scaricarlo. */
  onPreload3D: () => void
}

const OPTIONS: { id: BottleView; label: string; title: string }[] = [
  { id: '2d', label: '2D', title: 'Bottiglie piatte' },
  { id: '3d', label: '3D', title: 'Bottiglie in 3D, da girare' },
]

/** 2D | 3D accanto al titolo delle faccende. La scelta resta sul dispositivo (`lib/chores/bottle-view.ts`). */
export function BottleViewToggle({ view, onChange, onPreload3D }: BottleViewToggleProps) {
  return (
    <div role="group" aria-label="Vista delle bottiglie" className="inline-flex shrink-0 rounded-full border border-border-strong">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={view === option.id}
          title={option.title}
          onClick={() => onChange(option.id)}
          onPointerEnter={option.id === '3d' ? onPreload3D : undefined}
          onPointerDown={option.id === '3d' ? onPreload3D : undefined}
          onFocus={option.id === '3d' ? onPreload3D : undefined}
          className={cn(
            'flex h-11 min-w-12 items-center justify-center rounded-full px-3.5 text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            view === option.id ? 'bg-foreground text-background' : 'text-foreground hover:bg-surface-raised',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
