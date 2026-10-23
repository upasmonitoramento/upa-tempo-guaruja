const CACHE_NAME = "saude-guaruja-v3";

const urlsToCache = [
    "/",
    "/index.html",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png",
    "https://unpkg.com/leaflet/dist/leaflet.css",
    "https://unpkg.com/leaflet/dist/leaflet.js"
];

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