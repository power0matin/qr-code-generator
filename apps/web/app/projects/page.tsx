import type { Metadata } from 'next';
import { ProjectsView } from '@/components/projects-view';
export const metadata: Metadata = { title: 'Local QR Projects', description: 'Manage QR design projects stored locally in IndexedDB.', alternates: { canonical: '/projects' }, robots: { index: false, follow: true } };
export default function ProjectsPage() { return <div className="page shell"><span className="eyebrow">Local workspace</span><h1>Your QR projects stay on this device.</h1><p>Search, favorite, duplicate, rename, delete, and reopen saved designs without creating an account.</p><ProjectsView /></div>; }
