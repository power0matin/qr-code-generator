import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'QR Code with Logo', description: seoContent.logo.intro, alternates: { canonical: '/qr-code-with-logo' } };
export default function Page() { return <SeoPage content={seoContent.logo}/>; }
