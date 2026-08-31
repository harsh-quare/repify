// Repify service worker: offline app shell + cache-on-view exercise images.
// - Pages: network-first, falling back to the last cached copy (then '/').
// - Hashed Next.js assets: cache-first (immutable by construction).
// - Exercise images (Free Exercise DB on GitHub): cache-first, cached on
//   first view so storage grows only with what the user actually looks at.
// - Everything else (Supabase API, auth): straight to the network.

const VERSION = 'repify-v1';
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add('/').catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    cache.put(request, response.clone());
  }
  return response;
}

async function pageNetworkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    return hit ?? (await cache.match('/')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(pageNetworkFirst(request));
  }
});
