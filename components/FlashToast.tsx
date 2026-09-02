'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'

const MESSAGES: Record<string, { type: 'success' | 'error' | 'info'; text: string }> = {
  'expense-created': { type: 'success', text: 'Spesa salvata.' },
  'expense-updated': { type: 'success', text: 'Modifiche salvate.' },
  'expense-deleted': { type: 'success', text: 'Spesa eliminata.' },
  'settlement-registered': { type: 'success', text: 'Conguaglio registrato.' },
  'profile-updated': { type: 'success', text: 'Profilo aggiornato.' },
  'password-updated': { type: 'success', text: 'Password aggiornata.' },
}

export function FlashToast() {
  const router = useRouter()
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
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [ok, pathname, router, searchParams])

  return null
}
