import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/public-config';

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}
