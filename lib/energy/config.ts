/**
 * Credenziali MyFastweb, lette dalle variabili d'ambiente (solo server: nessun
 * prefisso NEXT_PUBLIC_). Senza tutte e due l'integrazione è spenta: la
 * schermata Energia lo dice e nessuna richiesta parte verso Fastweb.
 */
export interface FastwebConfig {
  username: string
  password: string
}

export function getFastwebConfig(): FastwebConfig | null {
  // Come la pagina di login di Fastweb, che toglie gli spazi a entrambi i campi.
  const username = process.env.FASTWEB_USERNAME?.trim()
  const password = process.env.FASTWEB_PASSWORD?.trim()
  if (!username || !password) return null
  return { username, password }
}
