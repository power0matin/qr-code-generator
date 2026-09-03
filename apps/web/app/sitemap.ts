import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/public-config';

const paths = [
  '/',
  '/generator',
  '/scanner',
  '/privacy',
  '/about',
  '/qr-code-generator',
  '/url-qr-code',
  '/wifi-qr-code',
  '/vcard-qr-code',
  '/whatsapp-qr-code',
  '/email-qr-code',
  '/text-qr-code',
  '/image-qr-code',
  '/pdf-qr-code',
  '/social-media-qr-code',
  '/qr-code-with-logo',
  '/qr-code-designer',
  '/qr-code-scanner',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicSiteUrl();
  return paths.map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: path === '/' || path === '/generator' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/generator' ? 0.95 : 0.7,
  }));
}
