import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Image QR Code Generator', description: seoContent.image.intro, alternates: { canonical: '/image-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.image}/>; }
