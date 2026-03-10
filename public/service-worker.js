const CACHE_NAME = 'ratonet-tracker-v10';

self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/admin',
                '/js/app.js',
                '/js/admin.js',
                '/favicon-viajante.svg',
                '/favicon-admin.svg'
            ]).catch(err => console.error("Cache add all failed", err));
        })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activate');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('firestore.googleapis.com')) {
        return; // Let Firebase handle its own offline persistence
    }
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
