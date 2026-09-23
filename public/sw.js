// Service worker di Casa Nostra. Fa una cosa sola: riceve lo scontrino che
// si condivide da un'altra app (galleria, fotocamera, file) verso l'app
// installata — il `share_target` del manifest, supportato su Android.
//
// È registrato con scope '/condividi' (components/ShareTargetWorker.tsx):
// controlla solo quella rotta, quindi non si mette in mezzo alle altre
// navigazioni né alle richieste dell'app. Niente cache delle pagine, niente
// offline: quelle sono un'altra storia.
//
// Perché un service worker e non una Route Handler: la condivisione arriva
// come POST con la foto nel corpo, e una foto di scontrino supera il limite
// del corpo delle funzioni serverless. Qui il file resta nel telefono: lo si
// parcheggia nella Cache Storage e la lista lo riprende per il controllo
// scontrino, che lo carica su Storage dal browser come sempre.

// Stessi valori di lib/share-target.ts.
const SHARE_CACHE = 'casa-nostra-condivisi'
const SHARED_RECEIPT_KEY = '/condiviso/scontrino'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/condividi') return
  event.respondWith(receiveShare(event.request))
})

async function receiveShare(request) {
  const goTo = (esito) =>
    Response.redirect(new URL('/lista?condiviso=' + esito, self.location.origin).href, 303)
  try {
    const form = await request.formData()
    const file = form.getAll('scontrino').find((value) => value instanceof File && value.size > 0)
    if (!file) return goTo('vuoto')
    const cache = await caches.open(SHARE_CACHE)
    await cache.put(SHARED_RECEIPT_KEY, new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'scontrino'),
      },
    }))
    return goTo('1')
  } catch {
    return goTo('errore')
  }
}
