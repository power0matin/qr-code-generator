const FALLBACK_SITE_URL = 'http://localhost:3000';

export function getPublicSiteUrl(): URL {
  const configured = process.env['NEXT_PUBLIC_SITE_URL'];
  try {
    const url = new URL(configured ?? FALLBACK_SITE_URL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return new URL(FALLBACK_SITE_URL);
    if (url.username || url.password) return new URL(FALLBACK_SITE_URL);
    return new URL(url.origin);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

export function getRepositoryUrl(): string | null {
  const configured = process.env['NEXT_PUBLIC_REPOSITORY_URL'];
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const path = url.pathname.split('/').filter(Boolean);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || path.length !== 2) return null;
    return `https://github.com/${path[0]}/${path[1]}`;
  } catch {
    return null;
  }
}
