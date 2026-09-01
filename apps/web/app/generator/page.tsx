import type { Metadata } from 'next';
import { Studio } from '@/components/studio';

export const metadata: Metadata = { title: 'QR Code Designer', description: 'Create and style static QR codes locally with scan-safety validation.', alternates: { canonical: '/generator' } };
export default function GeneratorPage() { return <Studio />; }
