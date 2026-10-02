/**
 * Come si vedono le bottiglie delle faccende: '2d' (di serie) o '3d'. La
 * scelta resta sul dispositivo, come il tema e l'accento: il 3D pesa di più e
 * su un telefono vecchio può non valerne la pena, quindi la si fa telefono per
 * telefono.
 *
 * Il server non la conosce: disegna sempre il 2D, e chi ha scelto il 3D lo
 * vede arrivare dopo l'idratazione (`useSyncExternalStore` con il 2D come
 * istantanea del server). three.js si scarica solo a quel punto.
 */

export type BottleView = '2d' | '3d'

export const BOTTLE_VIEW_KEY = 'chore-bottles'

const listeners = new Set<() => void>()
/** Se localStorage non c'è (navigazione privata), la scelta vale almeno finché la pagina resta aperta. */
let memory: BottleView | null = null

export function getBottleView(): BottleView {
  if (memory) return memory
  try {
    return localStorage.getItem(BOTTLE_VIEW_KEY) === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

export function getServerBottleView(): BottleView {
  return '2d'
}

export function setBottleView(view: BottleView) {
  memory = view
  try {
    if (view === '3d') localStorage.setItem(BOTTLE_VIEW_KEY, view)
    else localStorage.removeItem(BOTTLE_VIEW_KEY)
  } catch {}
  for (const listener of listeners) listener()
}

export function subscribeBottleView(listener: () => void): () => void {
  listeners.add(listener)
  // Un'altra scheda ha cambiato vista: la si segue.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== BOTTLE_VIEW_KEY) return
    memory = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
