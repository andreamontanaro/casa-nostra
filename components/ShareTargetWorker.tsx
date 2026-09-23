'use client'

import { useEffect } from 'react'

/**
 * Registra il service worker che riceve gli scontrini condivisi da altre app
 * (vedi `public/sw.js`). Scope ristretto a '/condividi': il worker non
 * controlla nessuna pagina dell'app, quindi non aggiunge niente al
 * caricamento delle altre schermate. Se il browser non lo supporta o la
 * registrazione fallisce, la condivisione semplicemente non c'è.
 */
export function ShareTargetWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/condividi', updateViaCache: 'none' })
      .catch(() => {})
  }, [])
  return null
}
