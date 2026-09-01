import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { OfflineStatus } from '@/components/offline-status';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Free QR Code Generator & Designer — Custom QR Codes | ModuQR', template: '%s | ModuQR' },
  description: 'Create private, custom QR codes with scan-safety checks, logos, presets, local projects, exports, and a built-in scanner.',
  applicationName: 'ModuQR',
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'ModuQR', title: 'ModuQR — Advanced QR Code Generator, Designer & Scanner', description: 'Design scannable QR codes locally in your browser.', images: ['/og.svg'] },
  twitter: { card: 'summary_large_image', title: 'ModuQR — Advanced QR Studio', description: 'Privacy-first custom QR generation with scan-safety checks.', images: ['/og.svg'] },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f5f6f8' }, { media: '(prefers-color-scheme: dark)', color: '#0c0d10' }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><a className="skip-link" href="#main">Skip to content</a><Script id="theme-bootstrap" strategy="beforeInteractive">{`try{const t=localStorage.getItem('moduqr-theme')||'system';const d=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d}catch{}`}</Script><Header /><main id="main">{children}</main><Footer /><OfflineStatus /></body></html>;
}
