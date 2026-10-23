const CACHE_NAME = "saude-guaruja-v6";

const urlsToCache = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png", "/logo-saude.png", "/apple-touch-icon.png", "/icon-192-v2.png", "/icon-512-v2.png", "/icon-maskable-512.png", "/brand.css?v=1", "/pwa.js?v=1"];

// 🔥 INSTALAÇÃO
self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(urlsToCache);
        })
    );
});

// 🔥 ATIVAÇÃO
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key.startsWith("saude-guaruja-") && key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            ).then(() => self.clients.claim());
        })
    );
});

// 🔥 FETCH (offline)
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (/^\/(auth|atendimento|admin|patrocinadores|anuncios|areas-ads|api)(\/|$)/.test(url.pathname)) return;
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response.ok) {
                    const copia = response.clone();
                    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia)));
                }
                return response;
            }).catch(() => caches.match(event.request).then(response => response || caches.match("/index.html")))
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});