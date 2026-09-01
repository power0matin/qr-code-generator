import Link from 'next/link';

export function Footer() {
  return <footer className="site-footer"><div className="shell footer-row"><span>ModuQR · Privacy-first QR tooling · MIT</span><div className="footer-links"><Link href="/privacy">Privacy</Link><Link href="/scanner">Scanner</Link><Link href="/qr-code-generator">QR Generator</Link></div></div></footer>;
}
