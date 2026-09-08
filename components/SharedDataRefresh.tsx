'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { WifiOff } from 'lucide-react'

function subscribeConnection(callback: () => void) {
  window.addEventListener('online', callback); window.addEventListener('offline', callback)
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback) }
}
export function SharedDataRefresh() {
  const router = useRouter()
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine, () => true)
  useEffect(() => {
    let lastRefresh = 0
    function refresh() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const focused = document.activeElement
      if (focused?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (Date.now() - lastRefresh < 5000) return
      lastRefresh = Date.now()
      router.refresh()
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])
  return online ? null : <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-sm"><WifiOff className="size-4 shrink-0 text-muted" aria-hidden />Sei offline. I dati si aggiorneranno al ritorno della connessione.</div>
}
