import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Email QR Code Generator', description: seoContent.email.intro, alternates: { canonical: '/email-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.email}/>; }
