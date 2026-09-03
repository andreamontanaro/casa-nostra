'use client'

import { useEffect } from 'react'

/**
 * Applica il tema "arcade" del modulo Casa (accent violetto invece del teal
 * fintech delle spese) anche agli overlay in portale — Sheet e Dialog di
 * Radix montano su `document.body`, quindi non sono discendenti del wrapper
 * `.chore-arena` renderizzato nell'albero React di `/casa`. Aggiungendo la
 * classe su `<html>` la copriamo comunque: `<body>` (e i suoi portali) resta
 * sempre discendente di `<html>` a prescindere da dove React li monta.
 *
 * La classe viene tolta allo smontaggio: uscire da `/casa` fa tornare
 * bottom nav e header al teal, `/casa` resta l'unico posto "diverso".
 */
export function ChoreArenaScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('chore-arena')
    return () => {
      document.documentElement.classList.remove('chore-arena')
    }
  }, [])

  return <>{children}</>
}
