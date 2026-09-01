import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'QR Code Designer', description: seoContent.designer.intro, alternates: { canonical: '/qr-code-designer' } };
export default function Page() { return <SeoPage content={seoContent.designer}/>; }
