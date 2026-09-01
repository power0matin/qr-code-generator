import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'WiFi QR Code Generator', description: seoContent.wifi.intro, alternates: { canonical: '/wifi-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.wifi}/>; }
