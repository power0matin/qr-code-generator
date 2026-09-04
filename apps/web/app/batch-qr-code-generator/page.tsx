import type { Metadata } from 'next';
import { BatchGenerator } from '@/components/batch-generator';
import { seoContent } from '@/lib/seo-content';

export const metadata: Metadata = {
  title: 'Batch QR Code Generator',
  description: seoContent.batch.intro,
  alternates: { canonical: '/batch-qr-code-generator' },
};

export default function Page() {
  return (
    <div className="page">
      <BatchGenerator />
    </div>
  );
}
