/**
 * Scontrino condiviso da un'altra app verso l'app installata (Android). Il
 * service worker (`public/sw.js`) lo parcheggia nella Cache Storage e manda
 * alla lista con `?condiviso=…`; la lista lo riprende da qui e apre il
 * controllo scontrino. I due nomi devono restare uguali a quelli del worker.
 */
export const SHARE_CACHE = 'casa-nostra-condivisi'
export const SHARED_RECEIPT_KEY = '/condiviso/scontrino'

/** Esiti che il worker (o la Route Handler di riserva) scrive nell'URL. */
export type ShareOutcome = '1' | 'vuoto' | 'errore' | 'non-pronto'

export const SHARE_ERRORS: Record<Exclude<ShareOutcome, '1'>, string> = {
  vuoto: 'Nella condivisione non c’era nessun file da controllare.',
  errore: 'Non sono riuscito a ricevere il file condiviso. Riprova, o caricalo dal controllo scontrino.',
  'non-pronto': 'L’app non era ancora pronta a ricevere file. Riprova adesso, o caricalo dal controllo scontrino.',
}

/** Riprende (e toglie) lo scontrino lasciato dal worker; `null` se non c'è. */
export async function takeSharedReceipt(): Promise<File | null> {
  if (typeof caches === 'undefined') return null
  const cache = await caches.open(SHARE_CACHE)
  const response = await cache.match(SHARED_RECEIPT_KEY)
  if (!response) return null
  await cache.delete(SHARED_RECEIPT_KEY)
  const blob = await response.blob()
  const name = decodeURIComponent(response.headers.get('X-File-Name') ?? 'scontrino')
  return new File([blob], name, { type: blob.type })
}
