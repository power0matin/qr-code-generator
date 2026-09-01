import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Batch QR Code Generator', description: seoContent.batch.intro, alternates: { canonical: '/batch-qr-code-generator' } };
export default function Page() { return <SeoPage content={seoContent.batch}/>; }
