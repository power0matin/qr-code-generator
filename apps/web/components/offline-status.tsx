'use client';

import { useEffect, useState } from 'react';

export function OfflineStatus() {
  const [offline, setOffline] = useState(false);
  const [cacheUnavailable, setCacheUnavailable] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => setCacheUnavailable(true));
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (offline) return <div className="offline-pill" role="status">Offline — all static QR tools are available</div>;
  return cacheUnavailable ? <div className="offline-pill" role="status">Offline cache unavailable — static QR generation still works while this page is open</div> : null;
}
