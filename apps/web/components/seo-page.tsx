import Link from 'next/link';

export interface SeoPageContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly bullets: readonly string[];
  readonly faq: readonly { readonly q: string; readonly a: string }[];
  readonly available: boolean;
  readonly ctaHref?: string;
  readonly ctaLabel?: string;
}

export function SeoPage({ content }: Readonly<{ content: SeoPageContent }>) {
  const faqJson = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  const ctaHref = content.available ? content.ctaHref ?? '/generator' : '/qr-code-generator';
  const ctaLabel = content.available ? content.ctaLabel ?? 'Open QR Studio' : 'Use the static generator';

  return <article className="page page-narrow">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson).replace(/</g, '\\u003c') }}/>
    <header className="seo-hero"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p></header>
    <section className="seo-entry">
      <h2>{content.available ? 'Use it in ModuQR' : 'Roadmap status'}</h2>
      <p>{content.available ? 'Open the relevant local tool. Static content is processed in your browser and does not need to be uploaded to ModuQR.' : 'This capability is intentionally documented as roadmap work and is not presented as a shipped feature.'}</p>
      <Link href={ctaHref} className={content.available ? 'button accent' : 'button'}>{ctaLabel}</Link>
    </section>
    <h2>What matters</h2>
    <ul>{content.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
    <h2>FAQ</h2>
    {content.faq.map((item) => <section key={item.q}><h3>{item.q}</h3><p>{item.a}</p></section>)}
  </article>;
}
