const CACHE_NAME = "saude-guaruja-v1";

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
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// 🔥 FETCH (offline)
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});