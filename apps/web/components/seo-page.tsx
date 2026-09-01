import Link from 'next/link';

export interface SeoPageContent {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly bullets: readonly string[];
  readonly faq: readonly { readonly q: string; readonly a: string }[];
  readonly available: boolean;
}

export function SeoPage({ content }: Readonly<{ content: SeoPageContent }>) {
  const faqJson = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: content.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) };
  return <article className="page page-narrow"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJson).replace(/</g, '\\u003c') }}/><header className="seo-hero"><span className="eyebrow">{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p></header><section className="seo-entry"><h2>{content.available ? 'Build it in ModuQR' : 'Roadmap status'}</h2><p>{content.available ? 'Open the static studio. Your content is encoded in the browser and does not need to be uploaded to ModuQR.' : 'This capability is intentionally not presented as shipped in Phase 1. The route documents the planned product surface without pretending the server-side feature exists.'}</p>{content.available ? <Link href="/generator" className="button accent">Open QR Studio</Link> : <Link href="/qr-code-generator" className="button">Use the static generator</Link>}</section><h2>What matters</h2><ul>{content.bullets.map((item) => <li key={item}>{item}</li>)}</ul><h2>FAQ</h2>{content.faq.map((item) => <section key={item.q}><h3>{item.q}</h3><p>{item.a}</p></section>)}</article>;
}
