'use client'

import { useState } from 'react'
import Link from 'next/link'

interface IntentLinkProps {
  href: string
  className?: string
  children: React.ReactNode
}

/**
 * Link che precarica la pagina solo quando si mostra l'intenzione di aprirla
 * — dito o puntatore sopra, fuoco da tastiera — invece che appena la riga
 * entra nello schermo. Nelle liste lunghe (lo storico) il prefetch di default
 * partiva per ogni riga visibile e ripartiva tutto dopo ogni salvataggio:
 * decine di richieste, ognuna con la sua verifica di sessione nel proxy, per
 * aprirne al massimo una.
 */
export function IntentLink({ href, className, children }: IntentLinkProps) {
  const [intent, setIntent] = useState(false)
  const arm = () => setIntent(true)

  return (
    <Link
      href={href}
      prefetch={intent ? null : false}
      onPointerEnter={arm}
      onFocus={arm}
      className={className}
    >
      {children}
    </Link>
  )
}
