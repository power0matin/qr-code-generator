import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'vCard QR Code Generator', description: seoContent.vcard.intro, alternates: { canonical: '/vcard-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.vcard}/>; }
