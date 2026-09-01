import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Text QR Code Generator', description: seoContent.text.intro, alternates: { canonical: '/text-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.text}/>; }
