'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'

const MESSAGES: Record<string, { type: 'success' | 'error' | 'info'; text: string }> = {
  'expense-created': { type: 'success', text: 'Spesa salvata.' },
  'expense-updated': { type: 'success', text: 'Modifiche salvate.' },
  'expense-deleted': { type: 'success', text: 'Spesa eliminata.' },
  'settlement-registered': { type: 'success', text: 'Conguaglio registrato.' },
  'profile-updated': { type: 'success', text: 'Profilo aggiornato.' },
  'password-updated': { type: 'success', text: 'Password aggiornata.' },
  'telegram-linked': { type: 'success', text: 'Account Telegram collegato.' },
  'telegram-unlinked': { type: 'success', text: 'Account Telegram scollegato.' },
}

/**
 * Mostra il toast di esito passato con `?ok=` dopo un redirect e poi toglie il
 * parametro dall'indirizzo. Con `history.replaceState`, che il router di Next
 * recepisce senza tornare al server: un `router.replace` rifaceva il render
 * dell'intera pagina, con tutte le sue query, solo per cambiare l'URL.
 */
export function FlashToast() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ok = searchParams.get('ok')

  useEffect(() => {
    if (!ok) return
    const m = MESSAGES[ok]
    if (m) toast[m.type](m.text)

    const params = new URLSearchParams(searchParams.toString())
    params.delete('ok')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }, [ok, pathname, searchParams])

  return null
}
