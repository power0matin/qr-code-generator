import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Free QR Code Generator', description: seoContent.generator.intro, alternates: { canonical: '/qr-code-generator' } };
export default function Page() { return <SeoPage content={seoContent.generator}/>; }
