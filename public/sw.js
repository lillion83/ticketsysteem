// Service worker voor de deurscanner (fase E). Doel: het scannerscherm opent
// ook na een herlaad of koude start zónder netwerk, zodat één per ongeluk
// herladen aan de deur de scanner niet doodt.
//
// Handmatig geschreven, geen build-tool of dependency. Strategie:
//   - navigaties (HTML): network-first, val terug op de cache → online altijd
//     vers, offline de laatst geziene versie.
//   - /assets/* (gehashte, onveranderlijke chunks): cache-first.
//   - /_serverFn/* en al het overige: met rust laten (altijd netwerk). De
//     scan-endpoints moeten vers zijn en falen offline netjes in de app zelf.

const CACHE = 'ticket-scanner-v1'

self.addEventListener('install', (event) => {
  // Meteen actief worden; we hebben geen precache-lijst nodig.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Oude cacheversies opruimen na een SW-update.
      const namen = await caches.keys()
      await Promise.all(
        namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Server functions en auth nooit cachen: die moeten vers zijn.
  if (url.pathname.startsWith('/_serverFn/') || url.pathname.startsWith('/api/')) {
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(navigatieAfhandelen(req))
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(assetAfhandelen(req))
  }
})

// Network-first met cache-fallback voor documenten.
async function navigatieAfhandelen(req) {
  const cache = await caches.open(CACHE)
  try {
    const respons = await fetch(req)
    if (respons && respons.ok) cache.put(req, respons.clone())
    return respons
  } catch {
    const gecached = await cache.match(req)
    if (gecached) return gecached
    throw new Error('offline en geen gecachte pagina')
  }
}

// Cache-first voor gehashte assets (naam wijzigt bij elke build, dus veilig).
async function assetAfhandelen(req) {
  const cache = await caches.open(CACHE)
  const gecached = await cache.match(req)
  if (gecached) return gecached
  const respons = await fetch(req)
  if (respons && respons.ok) cache.put(req, respons.clone())
  return respons
}
