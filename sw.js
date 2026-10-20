/* QuickQuiz By StudySphere - Service Worker */
const CACHE_NAME = 'quickquiz-v1.2';
const APP_SHELL = [
'./',
'./index.html',
'./dashboard.html',
'./manifest.json',
'./icon.svg'
];

// Install: Cache App Shell
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
return cache.addAll(APP_SHELL);
}).then(() => self.skipWaiting())
);
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((keys) => {
return Promise.all(
keys.map((key) => {
if (key !== CACHE_NAME) {
return caches.delete(key);
}
})
);
}).then(() => self.clients.claim())
);
});

// Fetch: Network First for Gemini API / Stale-While-Revalidate for app assets
self.addEventListener('fetch', (event) => {
const url = new URL(event.request.url);

// Always bypass cache for external Google Gemini AI generation requests
if (url.origin.includes('googleapis.com') || event.request.method !== 'GET') {
return;
}

event.respondWith(
caches.match(event.request).then((cachedResponse) => {
const fetchPromise = fetch(event.request).then((networkResponse) => {
if (networkResponse && networkResponse.status === 200) {
const responseToCache = networkResponse.clone();
caches.open(CACHE_NAME).then((cache) => {
cache.put(event.request, responseToCache);
});
}
return networkResponse;
}).catch(() => {
// Fallback when network is offline
return cachedResponse;
});

  return cachedResponse || fetchPromise;
})


);
});