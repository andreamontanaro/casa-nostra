'use client'

import { useEffect, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WifiOff } from 'lucide-react'

const CHECK_INTERVAL_MS = 30000
const MIN_GAP_MS = 5000

function subscribeConnection(callback: () => void) {
  window.addEventListener('online', callback); window.addEventListener('offline', callback)
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback) }
}

/** Non si ricarica sotto le mani di chi sta scrivendo o ha un dialog aperto. */
function canRefresh() {
  if (document.visibilityState !== 'visible' || !navigator.onLine) return false
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return false
  const focused = document.activeElement
  return !focused?.matches('input, textarea, select, [contenteditable="true"]')
}

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/sync', { cache: 'no-store' })
    if (!res.ok || res.redirected) return null
    const data: unknown = await res.json()
    const version = (data as { version?: unknown } | null)?.version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

/**
 * Tiene la pagina allineata a quello che fa l'altra persona (o l'assistente,
 * o il bot Telegram). Ogni 30 secondi, e al ritorno nella finestra o in rete,
 * chiede a `/api/sync` un'impronta dei dati: poche righe. Solo se è cambiata
 * rifà il render della pagina — prima lo storico e le statistiche riscaricavano
 * tutte le spese ogni 30 secondi anche quando non era cambiato niente.
 */
export function SharedDataRefresh() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine, () => true)
  useEffect(() => {
    let lastCheck = 0
    let checking = false
    // Impronta dei dati che la pagina sta mostrando; null se non la si conosce.
    // Il primo controllo, al montaggio, la fissa senza ricaricare: la pagina
    // è appena arrivata dal server.
    let shown: string | null = null
    let first = true

    async function check() {
      if (checking || !canRefresh() || Date.now() - lastCheck < MIN_GAP_MS) return
      checking = true
      lastCheck = Date.now()
      const version = await fetchVersion()
      checking = false
      if (first) { first = false; shown = version; return }
      if (version !== null && version === shown) return
      // Cambiato, o impossibile saperlo: si ricarica, ma solo se nel frattempo
      // non si è aperto un dialog — altrimenti ci riprova il giro successivo.
      if (!canRefresh()) return
      shown = version
      startTransition(() => router.refresh())
    }

    check()
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [router])
  return online ? null : <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-sm"><WifiOff className="size-4 shrink-0 text-muted" aria-hidden />Sei offline. I dati si aggiorneranno al ritorno della connessione.</div>
}
