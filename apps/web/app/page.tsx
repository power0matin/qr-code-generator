import Link from 'next/link';
import { Check, ScanLine, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { renderQR, DEFAULT_STYLE } from '@moduqr/renderer';

export default function HomePage() {
  const hero = renderQR('https://moduqr.dev', {
    ...DEFAULT_STYLE,
    moduleShape: 'rounded',
    finderOuterShape: 'rounded',
    finderInnerShape: 'circle',
    foreground: '#1b1f3a',
    gradient: {
      type: 'linear',
      angle: 35,
      stops: [
        { offset: 0, color: '#111827' },
        { offset: 0.55, color: '#5241f2' },
        { offset: 1, color: '#8b80ff' },
      ],
    },
  }, 360);

  const softwareJson = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ModuQR',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: 'Privacy-first open-source QR generator, designer and scanner.',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJson).replace(/</g, '\\u003c') }}
      />
      <div className="shell">
        <section className="hero">
          <div>
            <span className="eyebrow">
              <Sparkles size={14} /> Design without breaking scanability
            </span>
            <h1>QR design with a reliability layer.</h1>
            <p className="hero-copy">
              ModuQR is an open-source, privacy-first QR studio. Create polished static codes locally,
              see scan risks before exporting, and redesign scanned codes without routing your payload
              through a server.
            </p>
            <div className="hero-actions">
              <Link className="button accent" href="/generator">
                Open QR Studio
              </Link>
              <Link className="button" href="/scanner">
                Scan an image
              </Link>
            </div>
            <div className="hero-proof">
              <span>
                <Check size={14} /> Local static generation
              </span>
              <span>
                <Check size={14} /> SVG-first renderer
              </span>
              <span>
                <Check size={14} /> No account required
              </span>
            </div>
          </div>

          <div className="hero-card hero-preview-card">
            <div className="hero-card-topline">
              <span className="hero-kicker">Studio preview</span>
              <div className="hero-mini-pills" aria-label="Preview summary">
                <span className="mini-pill">Aurora preset</span>
                <span className="mini-pill success">96 / 100 safety</span>
              </div>
            </div>

            <div className="hero-preview-stage" aria-hidden="true">
              <div className="hero-orbit hero-orbit-a" />
              <div className="hero-orbit hero-orbit-b" />
              <div className="hero-stat hero-stat-left">
                <strong>Local only</strong>
                <span>Payload stays in your browser</span>
              </div>
              <div className="hero-stat hero-stat-right">
                <strong>SVG export</strong>
                <span>Same renderer as the editor</span>
              </div>
              <div className="hero-qr-shell">
                <div className="hero-qr" dangerouslySetInnerHTML={{ __html: hero.svg }} />
              </div>
            </div>

            <div className="hero-card-footer hero-card-footer-rich">
              <div>
                <strong>Designed in the same engine you export from</strong>
                <span>Rounded modules, controlled gradients, frame support, and decode-aware checks.</span>
              </div>
              <div className="hero-footer-metrics">
                <div className="metric-chip">
                  <span>Live preview</span>
                  <strong>1:1 renderer</strong>
                </div>
                <div className="score-pill">Scan checks enabled</div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-grid" aria-label="Core capabilities">
          <Feature
            icon={<ShieldCheck size={22} />}
            title="Scan Safety"
            text="Contrast, quiet-zone, density, logo, module-size, gradient, and real decode signals feed one explainable report."
          />
          <Feature
            icon={<WifiOff size={22} />}
            title="Private by default"
            text="Static payloads, logos, scanner images, and local projects stay in the browser. Static QR codes do not expire."
          />
          <Feature
            icon={<ScanLine size={22} />}
            title="Scan → Redesign"
            text="Decode an existing QR image, inspect its content safely, then open the payload directly in the same design engine."
          />
        </section>
      </div>
    </>
  );
}

function Feature({ icon, title, text }: Readonly<{ icon: React.ReactNode; title: string; text: string }>) {
  return (
    <article className="feature-card">
      {icon}
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}
