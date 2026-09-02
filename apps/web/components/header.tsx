import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';
import { getRepositoryUrl } from '@/lib/public-config';

function RepositoryIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="9" r="2" />
      <path d="M6 7v10" />
      <path d="M8 7h4a6 6 0 0 1 6 6v-2" />
    </svg>
  );
}

export function Header() {
  const repositoryUrl = getRepositoryUrl();

  return (
    <header className="site-header">
      <div className="shell header-row">
        <Link href="/" className="brand" aria-label="ModuQR home">
          <span className="brand-mark">MQ</span>
          <span>ModuQR</span>
        </Link>

        <nav className="nav" aria-label="Primary">
          <Link href="/generator">Generator</Link>
          <Link href="/scanner">Scanner</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/about">About</Link>
        </nav>

        <div className="header-actions">
          {repositoryUrl ? (
            <a
              className="icon-button"
              href={repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open ModuQR repository on GitHub"
            >
              <RepositoryIcon />
            </a>
          ) : null}
          <ThemeToggle />
          <Link className="button primary" href="/generator">
            Open Studio
          </Link>
        </div>
      </div>
    </header>
  );
}
