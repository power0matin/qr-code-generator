import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About', alternates: { canonical: '/about' } };

export default function AboutPage() {
  return <article className="page page-narrow">
    <span className="eyebrow">About ModuQR</span>
    <h1>A QR tool built around the part other editors hide: reliability.</h1>
    <p>ModuQR separates QR encoding from visual rendering, keeps static generation local, and treats scanability as a product feature rather than an afterthought.</p>
    <h2>Current scope</h2>
    <p>The static QR studio, local camera/image scanner, local projects, exports, PWA behavior, accessibility, SEO, professional design controls, safety simulations, and local batch generation form the current Phase 2 release-candidate foundation. The optional dynamic server platform remains a later milestone.</p>
  </article>;
}
