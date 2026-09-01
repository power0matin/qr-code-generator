import type { Metadata } from 'next';
import { SeoPage } from '@/components/seo-page';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = { title: 'Social Media QR Code Generator', description: seoContent.social.intro, alternates: { canonical: '/social-media-qr-code' } };
export default function Page() { return <SeoPage content={seoContent.social}/>; }
