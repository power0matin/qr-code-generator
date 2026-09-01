'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'moduqr-theme';
const THEME_EVENT = 'moduqr-theme-change';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function subscribeTheme(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

function readServerTheme(): Theme {
  return 'system';
}

function resolved(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return prefersDark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.setAttribute('data-theme', resolved(theme, media.matches));
    apply();
    if (theme === 'system') media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const cycle = () => {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    window.localStorage.setItem(THEME_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button className="icon-button" type="button" onClick={cycle} aria-label={`Theme: ${theme}. Change theme.`}>
      {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
