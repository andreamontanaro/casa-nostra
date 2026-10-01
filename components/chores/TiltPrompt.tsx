'use client'

import { useSyncExternalStore } from 'react'
import { Waves } from 'lucide-react'
import { getTiltStatus, requestTiltPermission, subscribeTiltStatus } from '@/lib/chores/device-tilt'

/**
 * Su iOS il liquido delle bottiglie può seguire i sensori del telefono solo
 * dopo un tocco che lo chiede (Safari mostra il suo avviso). Il bottone
 * compare solo lì, solo quando i dati non arrivano già, e sparisce appena si
 * risponde; su Android e altrove i sensori funzionano da soli e qui non si
 * vede niente. Sta accanto al titolo, in un angolo che non sposta nulla
 * quando compare.
 */
export function TiltPrompt() {
  const status = useSyncExternalStore(subscribeTiltStatus, getTiltStatus, () => 'off' as const)
  if (status !== 'ask') return null
  return (
    <button
      type="button"
      onClick={() => void requestTiltPermission()}
      aria-label="Fai ondeggiare il liquido inclinando il telefono"
      title="Fai ondeggiare il liquido inclinando il telefono"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent-soft transition-transform active:scale-95"
    >
      <Waves className="size-5" aria-hidden />
    </button>
  )
}
