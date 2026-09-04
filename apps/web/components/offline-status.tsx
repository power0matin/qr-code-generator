'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const CACHE_PREFIX = 'moduqr-static-';
const DEV_CLEANUP_KEY = 'moduqr-dev-sw-cleaned';
const RUNTIME_CACHE_MESSAGE = 'MODUQR_CACHE_RUNTIME_ASSETS';

function subscribeNetwork(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function readOnline(): boolean {
  return navigator.onLine;
}

function readServerOnline(): boolean {
  return true;
}

async function clearDevelopmentServiceWorker(): Promise<void> {
  try {
    if (sessionStorage.getItem(DEV_CLEANUP_KEY) === '1') return;
    sessionStorage.setItem(DEV_CLEANUP_KEY, '1');
  } catch {
    // Storage may be blocked; stale service-worker cleanup should still continue.
  }
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
  }
}

function runtimeAssetUrls(): readonly string[] {
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType('resource')) {
    try {
      const url = new URL(entry.name, window.location.href);
      if (url.origin !== window.location.origin) continue;
      if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
        urls.add(url.toString());
      }
    } catch {
      // Ignore malformed performance entries from browser extensions or tooling.
    }
  }
  return [...urls].slice(0, 128);
}

async function registerProductionServiceWorker(): Promise<void> {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const ready = await navigator.serviceWorker.ready;
  await registration.update();
  const worker = ready.active ?? ready.waiting ?? ready.installing;
  worker?.postMessage({ type: RUNTIME_CACHE_MESSAGE, urls: runtimeAssetUrls() });
}

export function OfflineStatus() {
  const online = useSyncExternalStore(subscribeNetwork, readOnline, readServerOnline);
  const [cacheUnavailable, setCacheUnavailable] = useState(false);

  useEffect(() => {
    if (process.env['NODE_ENV'] !== 'production') {
      void clearDevelopmentServiceWorker().catch(() => undefined).finally(() => {
        document.documentElement.dataset['moduqrSwCleanup'] = 'done';
      });
    } else if ('serviceWorker' in navigator) {
      void registerProductionServiceWorker()
        .then(() => { document.documentElement.dataset['moduqrSwReady'] = 'done'; })
        .catch(() => setCacheUnavailable(true));
    }
  }, []);

  if (!online) return <div className="offline-pill" role="status">Offline — cached static QR tools remain available</div>;
  return cacheUnavailable ? <div className="offline-pill" role="status">Offline cache unavailable — static QR generation still works while this page is open</div> : null;
}
