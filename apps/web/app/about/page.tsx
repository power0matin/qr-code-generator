import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return <article className="page page-narrow">
    <span className="eyebrow">About ModuQR</span>
    <h1>A QR tool built around the part other editors hide: reliability.</h1>
    <p>ModuQR separates QR encoding from visual rendering, keeps static generation local, and treats scanability as a product feature rather than an afterthought.</p>
    <h2>Current scope</h2>
    <p>The static QR studio, local image scanner, local projects, exports, PWA behavior, accessibility, SEO, and open-source quality form the current release-candidate foundation. Phase 2 is expanding the professional designer while the optional dynamic server platform remains a later milestone.</p>
  </article>;
}
