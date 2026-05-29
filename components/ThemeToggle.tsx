'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'system'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  } else {
    root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(readTheme())
    setMounted(true)
  }, [])

  function handleChange(next: Theme) {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex w-full rounded-2xl border border-border bg-surface-sunken p-1"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleChange(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl h-10 text-sm font-medium',
              'transition-colors duration-150',
              active
                ? 'bg-surface text-foreground shadow-soft'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
