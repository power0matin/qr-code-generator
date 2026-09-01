import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'QR Code Scanner', description: seoContent.scanner.intro, alternates: { canonical: '/qr-code-scanner' } };
export default function Page() { return <SeoPage content={seoContent.scanner}/>; }
