import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'PDF QR Code Generator', description: seoContent.pdf.intro, alternates: { canonical: '/pdf-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.pdf}/>; }
