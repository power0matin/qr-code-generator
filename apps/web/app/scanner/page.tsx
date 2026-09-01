import type { Metadata } from 'next';
import { Scanner } from '@/components/scanner';
export const metadata: Metadata = { title: 'QR Code Scanner', description: 'Decode QR codes from images locally, preview content safely, and redesign them.', alternates: { canonical: '/scanner' } };
export default function ScannerPage() { return <div className="page page-narrow"><span className="eyebrow">Local decoder</span><h1>Scan without sending the image anywhere.</h1><p>Upload, drag, or paste an image. ModuQR decodes it in your browser and never opens unknown links automatically.</p><Scanner /></div>; }
