import Link from 'next/link';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  const repositoryUrl = process.env['NEXT_PUBLIC_REPOSITORY_URL'];
  return <header className="site-header">
    <div className="shell header-row">
      <Link className="brand" href="/" aria-label="ModuQR home"><span className="brand-mark">M</span><span>ModuQR</span></Link>
      <nav className="nav" aria-label="Primary"><Link href="/generator">Designer</Link><Link href="/scanner">Scanner</Link><Link href="/projects">Projects</Link><Link href="/privacy">Privacy</Link></nav>
      <div className="header-actions">{repositoryUrl ? <a className="text-link" href={repositoryUrl} aria-label="GitHub repository" rel="noreferrer">GitHub</a> : null}<ThemeToggle /></div>
    </div>
  </header>;
}
