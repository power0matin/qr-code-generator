import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'URL QR Code Generator', description: seoContent.url.intro, alternates: { canonical: '/url-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.url}/>; }
