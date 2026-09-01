import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Dynamic QR Code', description: seoContent.dynamic.intro, alternates: { canonical: '/dynamic-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.dynamic}/>; }
