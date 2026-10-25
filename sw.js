/**
 * StudySphere QuickQuiz 2.0 - Resilient Offline Service Worker
 * Version: v2.1 (Cache-busting update for smooth user migration)
 * 
 * Features:
 * - Immediate activation on code changes via skipWaiting() and clients.claim()
 * - Automatic purging of outdated caches (v1.x, v2.0)
 * - Strict BYPASS for Gemini API calls & network mutations
 * - Stale-While-Revalidate caching strategy for instant loading
 */

const CACHE_NAME = 'quickquiz-v2.1-cache';

// Core Application Shell Assets
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './quiz.html',
  './dashboard.html',
  './manifest.json',
  './icon.svg',
  './lightning.svg',
  './assets/css/common.css',
  './assets/js/storage.js',
  './assets/js/dashboard.js',
  './assets/js/quiz.js'
];

// 1. Install Phase: Cache App Shell immediately and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Phase: Purge Outdated Caches and claim clients instantly
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Purging outdated cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Strategy:
// - Always BYPASS cache for Google Gemini AI endpoints, Firebase, Google Script & non-GET calls
// - Stale-While-Revalidate for app shell files
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Critical: Always stream live AI responses directly from network
  if (
    requestUrl.origin.includes('googleapis.com') ||
    requestUrl.origin.includes('generativelanguage') ||
    requestUrl.origin.includes('google.com') ||
    requestUrl.origin.includes('firebase') ||
    requestUrl.origin.includes('script.google.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Fetch fresh copy in the background to update cache
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, fallback already provided by cachedResponse
          return cachedResponse;
        });

      // Return cached version immediately if available, else await network
      return cachedResponse || fetchPromise;
    })
  );
});