// Somente a estrutura do aplicativo fica disponível offline. Fotos, anúncios e API não são salvos aqui.
const CACHE_NAME = 'saude-guaruja-v9'
const SHELL = ['/index.html', '/manifest.json', '/favicon-32.png', '/icon-192-v2.png', '/brand.css?v=1', '/experience.css?v=1', '/pwa.js?v=1', '/public-ui.js?v=1']

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('saude-guaruja-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    if (url.origin !== self.location.origin) return
    if (/^\/(auth|atendimento|admin|patrocinadores|anuncios|areas-ads|api|images)(\/|$)/.test(url.pathname)) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }))
        return
    }
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).then(response => {
            if (response.ok && ['/', '/index.html'].includes(url.pathname)) {
                const copy = response.clone()
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)))
            }
            return response
        }).catch(() => caches.match('/index.html')))
        return
    }
    if (SHELL.includes(url.pathname + url.search)) {
        event.respondWith(fetch(event.request, {cache:'no-cache'}).then(response => {
            if (response.ok) {
                const copy = response.clone()
                event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)))
            }
            return response
        }).catch(() => caches.match(event.request)))
    }
})
