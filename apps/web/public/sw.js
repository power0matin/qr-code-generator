const CACHE = 'moduqr-static-v4';
const CORE = ['/', '/generator', '/scanner', '/privacy', '/icons/icon.svg'];
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest', 'worker']);
const RUNTIME_CACHE_MESSAGE = 'MODUQR_CACHE_RUNTIME_ASSETS';

async function precacheCore() {
  const cache = await caches.open(CACHE);
  let generatorCached = false;
  await Promise.all(CORE.map(async (path) => {
    try {
      const response = await fetch(path, { cache: 'reload', credentials: 'same-origin' });
      if (!response.ok || response.type === 'opaque') return;
      await cache.put(path, response.clone());
      if (path === '/generator') generatorCached = true;
    } catch {
      // Secondary routes are best effort; the generator itself is required below.
    }
  }));
  if (!generatorCached) throw new Error('The offline generator could not be precached.');
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheCore());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const cleanup = caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('moduqr-static-') && key !== CACHE).map((key) => caches.delete(key)),
  ));
  event.waitUntil(Promise.all([cleanup, self.clients.claim()]));
});

function isWarmableRuntimeUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return false;
    return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest';
  } catch {
    return false;
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== RUNTIME_CACHE_MESSAGE || !Array.isArray(event.data.urls)) return;
  const urls = [...new Set(event.data.urls.filter((value) => typeof value === 'string' && isWarmableRuntimeUrl(value)))].slice(0, 128);
  if (urls.length === 0) return;
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (response.ok && response.type !== 'opaque' && !String(response.headers.get('content-type') ?? '').includes('text/html')) {
            await cache.put(url, response.clone());
          }
        } catch {
          // Runtime warming is best effort; normal fetch handling still works online.
        }
      }));
    }),
  );
});

async function cacheResponse(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const contentType = response.headers.get('content-type') || '';
  if (request.mode !== 'navigate' && contentType.includes('text/html')) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match('/generator')) || Response.error();
  }
}

async function assetRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await cacheResponse(request, response);
  return response;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (CACHEABLE_DESTINATIONS.has(event.request.destination)) {
    event.respondWith(assetRequest(event.request));
  }
});
