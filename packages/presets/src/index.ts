import { DEFAULT_STYLE } from '@moduqr/renderer';
import type { QRStyle } from '@moduqr/shared';

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly category: 'Minimal' | 'Corporate' | 'Luxury' | 'Dark' | 'Pastel' | 'Neon' | 'Organic' | 'Social' | 'WiFi' | 'Developer';
  readonly tags: readonly string[];
  readonly style: QRStyle;
}

function preset(id: string, name: string, category: Preset['category'], patch: Partial<QRStyle>, tags: readonly string[] = []): Preset {
  return { id, name, category, tags, style: { ...DEFAULT_STYLE, ...patch, logo: { ...DEFAULT_STYLE.logo, ...(patch.logo ?? {}) }, frame: { ...DEFAULT_STYLE.frame, ...(patch.frame ?? {}) } } };
}

export const PRESETS: readonly Preset[] = [
  preset('ink', 'Ink', 'Minimal', { moduleShape: 'square', finderOuterShape: 'square', finderInnerShape: 'square', foreground: '#111111', background: '#ffffff', moduleGap: 0 }),
  preset('soft-paper', 'Soft Paper', 'Minimal', { moduleShape: 'rounded', foreground: '#1f2937', background: '#fafaf9' }),
  preset('mono-dot', 'Mono Dot', 'Minimal', { moduleShape: 'dots', finderOuterShape: 'rounded', finderInnerShape: 'circle', foreground: '#18181b', background: '#ffffff', moduleGap: 0.02 }),
  preset('slate-office', 'Slate Office', 'Corporate', { moduleShape: 'soft-square', foreground: '#0f172a', background: '#f8fafc' }),
  preset('navy-report', 'Navy Report', 'Corporate', { foreground: '#172554', background: '#eff6ff', moduleShape: 'rounded' }),
  preset('charcoal-card', 'Charcoal Card', 'Corporate', { foreground: '#27272a', background: '#fafafa', finderInnerShape: 'circle' }),
  preset('obsidian', 'Obsidian', 'Dark', { foreground: '#f8fafc', background: '#09090b', moduleShape: 'soft-square' }),
  preset('midnight-blue', 'Midnight Blue', 'Dark', { foreground: '#dbeafe', background: '#0f172a', moduleShape: 'rounded' }),
  preset('graphite-dot', 'Graphite Dot', 'Dark', { foreground: '#f4f4f5', background: '#18181b', moduleShape: 'dots', finderOuterShape: 'circle', finderInnerShape: 'circle' }),
  preset('champagne', 'Champagne', 'Luxury', { foreground: '#422006', background: '#fffbeb', moduleShape: 'extra-rounded', finderOuterShape: 'rounded' }),
  preset('emerald-noir', 'Emerald Noir', 'Luxury', { foreground: '#d1fae5', background: '#022c22', moduleShape: 'soft-square' }),
  preset('plum-silk', 'Plum Silk', 'Luxury', { foreground: '#581c87', background: '#faf5ff', finderInnerShape: 'circle' }),
  preset('lavender', 'Lavender', 'Pastel', { foreground: '#4c1d95', background: '#f5f3ff', moduleShape: 'rounded' }),
  preset('mint', 'Mint', 'Pastel', { foreground: '#064e3b', background: '#ecfdf5', moduleShape: 'soft-square' }),
  preset('rose-paper', 'Rose Paper', 'Pastel', { foreground: '#881337', background: '#fff1f2', moduleShape: 'rounded' }),
  preset('cyan-night', 'Cyan Night', 'Neon', { background: '#020617', foreground: '#67e8f9', moduleShape: 'dots', finderOuterShape: 'rounded', finderInnerShape: 'circle' }),
  preset('lime-terminal', 'Lime Terminal', 'Neon', { background: '#052e16', foreground: '#bef264', moduleShape: 'pixel', finderOuterShape: 'square', finderInnerShape: 'square', moduleGap: 0 }),
  preset('violet-grid', 'Violet Grid', 'Neon', { background: '#1e1b4b', foreground: '#c4b5fd', moduleShape: 'diamond', moduleGap: 0.04 }),
  preset('forest', 'Forest', 'Organic', { foreground: '#14532d', background: '#f0fdf4', moduleShape: 'circle', finderOuterShape: 'rounded', finderInnerShape: 'circle' }),
  preset('clay', 'Clay', 'Organic', { foreground: '#7c2d12', background: '#fff7ed', moduleShape: 'extra-rounded' }),
  preset('social-blue', 'Social Blue', 'Social', { foreground: '#1e40af', background: '#eff6ff', moduleShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: 'Follow us' } }),
  preset('wifi-card', 'WiFi Card', 'WiFi', { foreground: '#0f172a', background: '#f1f5f9', moduleShape: 'soft-square', frame: { ...DEFAULT_STYLE.frame, style: 'label', text: 'Connect WiFi' } }),
  preset('github-dark', 'GitHub Dark', 'Developer', { foreground: '#f8fafc', background: '#0d1117', moduleShape: 'square', finderOuterShape: 'rounded', finderInnerShape: 'square' }),
  preset('terminal', 'Terminal', 'Developer', { foreground: '#86efac', background: '#052e16', moduleShape: 'pixel', finderOuterShape: 'square', finderInnerShape: 'square', moduleGap: 0 }),
] as const;

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((item) => item.id === id);
}
