'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function resolved(theme: Theme, prefersDark?: boolean): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  const dark = prefersDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = window.localStorage.getItem('moduqr-theme');
    setTheme(saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system');
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.setAttribute('data-theme', resolved(theme, media.matches));
    apply();
    if (theme === 'system') media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    window.localStorage.setItem('moduqr-theme', next);
    setTheme(next);
  };

  return <button className="icon-button" type="button" onClick={cycle} aria-label={`Theme: ${theme}. Change theme.`}>{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}</button>;
}
