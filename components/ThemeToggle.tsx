'use client'

import { useSyncExternalStore } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'
const options = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : 'system'
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== 'theme') return
    if (event.newValue === 'light' || event.newValue === 'dark') document.documentElement.setAttribute('data-theme', event.newValue)
    else document.documentElement.removeAttribute('data-theme')
  }
  window.addEventListener('storage', syncStorage)
  return () => { observer.disconnect(); window.removeEventListener('storage', syncStorage) }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system')
  function change(next: Theme) {
    if (next === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', next)
    try {
      if (next === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', next)
    } catch {}
  }
  return (
    <div role="group" aria-label="Aspetto dell’app" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-raised p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" aria-pressed={theme === value} onClick={() => change(value)}
          className={cn('flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium transition-colors',
            theme === value ? 'bg-surface text-accent shadow-soft' : 'text-muted hover:text-foreground')}>
          <Icon className="size-4" aria-hidden />{label}
        </button>
      ))}
    </div>
  )
}
