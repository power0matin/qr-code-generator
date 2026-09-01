import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'WhatsApp QR Code Generator', description: seoContent.whatsapp.intro, alternates: { canonical: '/whatsapp-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.whatsapp}/>; }
