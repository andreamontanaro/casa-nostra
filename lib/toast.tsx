'use client'

import { useSyncExternalStore } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

const DURATION_MS = 3500

const store = {
  toasts: [] as ToastItem[],
  listeners: new Set<() => void>(),

  notify() {
    this.listeners.forEach((l) => l())
  },

  add(message: string, type: ToastType) {
    const id = Math.random().toString(36).slice(2)
    this.toasts = [...this.toasts, { id, message, type }]
    this.notify()
    setTimeout(() => this.remove(id), DURATION_MS)
  },

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  },

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  },

  getSnapshot() {
    return this.toasts
  },
}

export const toast = {
  success: (message: string) => store.add(message, 'success'),
  error: (message: string) => store.add(message, 'error'),
  info: (message: string) => store.add(message, 'info'),
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="size-5 shrink-0 text-accent" />,
  error: <XCircle className="size-5 shrink-0 text-destructive" />,
  info: <Info className="size-5 shrink-0 text-muted" />,
}

export function Toaster() {
  const toasts = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  )

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
        >
          {icons[t.type]}
          <p className="flex-1 text-sm text-foreground">{t.message}</p>
          <button
            onClick={() => store.remove(t.id)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Chiudi"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
