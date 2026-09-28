'use client'

import { useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, isAccent, type Accent } from '@/lib/theme'
import { cn } from '@/lib/utils'

function readAccent(): Accent {
  const value = document.documentElement.dataset.accent
  return isAccent(value) ? value : DEFAULT_ACCENT
}

function applyAccent(accent: Accent) {
  if (accent === DEFAULT_ACCENT) document.documentElement.removeAttribute('data-accent')
  else document.documentElement.setAttribute('data-accent', accent)
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-accent'] })
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== ACCENT_STORAGE_KEY) return
    applyAccent(isAccent(event.newValue) ? event.newValue : DEFAULT_ACCENT)
  }
  window.addEventListener('storage', syncStorage)
  return () => { observer.disconnect(); window.removeEventListener('storage', syncStorage) }
}

/**
 * Colore d'accento dell'app, accanto a `ThemeToggle`: vale per chiaro e scuro
 * e resta sul dispositivo come il tema. Lo stato è l'attributo `data-accent`
 * su <html> (impostato prima del primo paint dallo script in `app/layout.tsx`).
 */
export function AccentPicker() {
  const accent = useSyncExternalStore(subscribe, readAccent, () => DEFAULT_ACCENT)
  function change(next: Accent) {
    applyAccent(next)
    try {
      if (next === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_STORAGE_KEY)
      else localStorage.setItem(ACCENT_STORAGE_KEY, next)
    } catch {}
  }
  return (
    <div role="group" aria-label="Colore dell’app" className="grid grid-cols-5 gap-1 rounded-2xl bg-surface-raised p-1">
      {ACCENTS.map(({ id, label, light, dark }) => (
        <button key={id} type="button" aria-pressed={accent === id} aria-label={label} title={label} onClick={() => change(id)}
          className={cn('flex min-h-12 min-w-0 items-center justify-center rounded-xl transition-colors',
            accent === id ? 'bg-surface shadow-soft' : 'hover:bg-surface/60')}>
          <span className="accent-swatch flex size-7 items-center justify-center rounded-full"
            style={{ '--swatch': light, '--swatch-dk': dark } as React.CSSProperties}>
            {accent === id && <Check className="size-4 text-background" strokeWidth={3} aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  )
}
