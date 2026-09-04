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
  return {
    id,
    name,
    category,
    tags,
    style: {
      ...DEFAULT_STYLE,
      ...patch,
      finderOverrides: {
        topLeft: { ...DEFAULT_STYLE.finderOverrides.topLeft, ...(patch.finderOverrides?.topLeft ?? {}) },
        topRight: { ...DEFAULT_STYLE.finderOverrides.topRight, ...(patch.finderOverrides?.topRight ?? {}) },
        bottomLeft: { ...DEFAULT_STYLE.finderOverrides.bottomLeft, ...(patch.finderOverrides?.bottomLeft ?? {}) },
      },
      regionStyles: {
        data: { ...DEFAULT_STYLE.regionStyles.data, ...(patch.regionStyles?.data ?? {}) },
        timing: { ...DEFAULT_STYLE.regionStyles.timing, ...(patch.regionStyles?.timing ?? {}) },
        alignment: { ...DEFAULT_STYLE.regionStyles.alignment, ...(patch.regionStyles?.alignment ?? {}) },
      },
      logo: { ...DEFAULT_STYLE.logo, ...(patch.logo ?? {}) },
      frame: { ...DEFAULT_STYLE.frame, ...(patch.frame ?? {}) },
    },
  };
}

const gradient = (a: string, b: string, angle = 45): QRStyle['gradient'] => ({
  type: 'linear',
  angle,
  stops: [{ offset: 0, color: a }, { offset: 1, color: b }],
});

export const PRESETS: readonly Preset[] = [
  preset('ink', 'Ink', 'Minimal', { moduleShape: 'square', finderOuterShape: 'square', finderInnerShape: 'square', foreground: '#111111', background: '#ffffff', moduleGap: 0 }, ['mono', 'print']),
  preset('soft-paper', 'Soft Paper', 'Minimal', { moduleShape: 'rounded', foreground: '#1f2937', background: '#fafaf9' }, ['soft', 'paper']),
  preset('mono-dot', 'Mono Dot', 'Minimal', { moduleShape: 'dots', finderOuterShape: 'rounded', finderInnerShape: 'circle', foreground: '#18181b', background: '#ffffff', moduleGap: 0.02 }, ['dots', 'mono']),
  preset('clean-slate', 'Clean Slate', 'Minimal', { moduleShape: 'soft-square', foreground: '#0f172a', background: '#ffffff', moduleGap: 0.04 }, ['clean']),
  preset('warm-ivory', 'Warm Ivory', 'Minimal', { moduleShape: 'rounded', foreground: '#292524', background: '#fffbeb' }, ['warm']),
  preset('blueprint', 'Blueprint', 'Minimal', { moduleShape: 'connected', foreground: '#1e3a8a', background: '#eff6ff', moduleGap: 0 }, ['connected', 'blue']),

  preset('slate-office', 'Slate Office', 'Corporate', { moduleShape: 'soft-square', foreground: '#0f172a', background: '#f8fafc' }, ['business']),
  preset('navy-report', 'Navy Report', 'Corporate', { foreground: '#172554', background: '#eff6ff', moduleShape: 'rounded' }, ['navy']),
  preset('charcoal-card', 'Charcoal Card', 'Corporate', { foreground: '#27272a', background: '#fafafa', finderInnerShape: 'circle' }, ['card']),
  preset('boardroom', 'Boardroom', 'Corporate', { foreground: '#1e293b', background: '#ffffff', moduleShape: 'connected', frame: { ...DEFAULT_STYLE.frame, style: 'minimal', text: 'Scan' } }, ['frame', 'business']),
  preset('steel-blue', 'Steel Blue', 'Corporate', { foreground: '#0c4a6e', background: '#f0f9ff', moduleShape: 'soft-square', finderOuterShape: 'rounded' }, ['blue']),
  preset('executive-green', 'Executive Green', 'Corporate', { foreground: '#14532d', background: '#f7fee7', moduleShape: 'rounded' }, ['green']),

  preset('obsidian', 'Obsidian', 'Dark', { foreground: '#f8fafc', background: '#09090b', moduleShape: 'soft-square' }, ['dark']),
  preset('midnight-blue', 'Midnight Blue', 'Dark', { foreground: '#dbeafe', background: '#0f172a', moduleShape: 'rounded' }, ['dark', 'blue']),
  preset('graphite-dot', 'Graphite Dot', 'Dark', { foreground: '#f4f4f5', background: '#18181b', moduleShape: 'dots', finderOuterShape: 'circle', finderInnerShape: 'circle' }, ['dark', 'dots']),
  preset('night-violet', 'Night Violet', 'Dark', { foreground: '#ede9fe', background: '#2e1065', moduleShape: 'connected' }, ['dark', 'violet']),
  preset('carbon', 'Carbon', 'Dark', { foreground: '#e2e8f0', background: '#020617', moduleShape: 'square', finderOuterShape: 'rounded' }, ['dark', 'mono']),
  preset('deep-teal', 'Deep Teal', 'Dark', { foreground: '#ccfbf1', background: '#042f2e', moduleShape: 'rounded' }, ['dark', 'teal']),

  preset('champagne', 'Champagne', 'Luxury', { foreground: '#422006', background: '#fffbeb', moduleShape: 'extra-rounded', finderOuterShape: 'rounded' }, ['gold', 'elegant']),
  preset('emerald-noir', 'Emerald Noir', 'Luxury', { foreground: '#d1fae5', background: '#022c22', moduleShape: 'soft-square' }, ['elegant', 'green']),
  preset('plum-silk', 'Plum Silk', 'Luxury', { foreground: '#581c87', background: '#faf5ff', finderInnerShape: 'circle' }, ['purple']),
  preset('royal-ink', 'Royal Ink', 'Luxury', { foreground: '#312e81', background: '#fefce8', moduleShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'badge', text: 'Scan me' } }, ['frame']),
  preset('copper', 'Copper', 'Luxury', { foreground: '#7c2d12', background: '#fff7ed', moduleShape: 'connected' }, ['warm']),
  preset('sapphire', 'Sapphire', 'Luxury', { foreground: '#1e40af', background: '#f8fafc', moduleShape: 'extra-rounded', finderInnerShape: 'circle' }, ['blue']),

  preset('lavender', 'Lavender', 'Pastel', { foreground: '#4c1d95', background: '#f5f3ff', moduleShape: 'rounded' }, ['pastel']),
  preset('mint', 'Mint', 'Pastel', { foreground: '#064e3b', background: '#ecfdf5', moduleShape: 'soft-square' }, ['pastel']),
  preset('rose-paper', 'Rose Paper', 'Pastel', { foreground: '#881337', background: '#fff1f2', moduleShape: 'rounded' }, ['pastel']),
  preset('peach-note', 'Peach Note', 'Pastel', { foreground: '#7c2d12', background: '#fff7ed', moduleShape: 'dots', finderOuterShape: 'rounded' }, ['pastel']),
  preset('sky-note', 'Sky Note', 'Pastel', { foreground: '#075985', background: '#f0f9ff', moduleShape: 'extra-rounded' }, ['pastel']),
  preset('lilac-grid', 'Lilac Grid', 'Pastel', { foreground: '#5b21b6', background: '#faf5ff', moduleShape: 'soft-square', regionStyles: { ...DEFAULT_STYLE.regionStyles, timing: { color: '#6d28d9', shape: 'square' } } }, ['pastel', 'region']),

  preset('cyan-night', 'Cyan Night', 'Neon', { background: '#020617', foreground: '#67e8f9', moduleShape: 'dots', finderOuterShape: 'rounded', finderInnerShape: 'circle' }, ['neon']),
  preset('lime-terminal', 'Lime Terminal', 'Neon', { background: '#052e16', foreground: '#bef264', moduleShape: 'pixel', finderOuterShape: 'square', finderInnerShape: 'square', moduleGap: 0 }, ['neon', 'terminal']),
  preset('violet-grid', 'Violet Grid', 'Neon', { background: '#1e1b4b', foreground: '#c4b5fd', moduleShape: 'diamond', moduleGap: 0.04 }, ['neon']),
  preset('electric-blue', 'Electric Blue', 'Neon', { background: '#082f49', foreground: '#a5f3fc', moduleShape: 'connected' }, ['neon', 'connected']),
  preset('laser-pink', 'Laser Pink', 'Neon', { background: '#500724', foreground: '#fbcfe8', moduleShape: 'rounded', finderInnerShape: 'circle' }, ['neon', 'pink']),
  preset('acid-grid', 'Acid Grid', 'Neon', { background: '#1a2e05', foreground: '#d9f99d', moduleShape: 'soft-square', finderOuterShape: 'rounded' }, ['neon']),

  preset('forest', 'Forest', 'Organic', { foreground: '#14532d', background: '#f0fdf4', moduleShape: 'circle', finderOuterShape: 'rounded', finderInnerShape: 'circle' }, ['organic']),
  preset('clay', 'Clay', 'Organic', { foreground: '#7c2d12', background: '#fff7ed', moduleShape: 'extra-rounded' }, ['organic']),
  preset('moss', 'Moss', 'Organic', { foreground: '#365314', background: '#f7fee7', moduleShape: 'connected' }, ['organic', 'connected']),
  preset('ocean', 'Ocean', 'Organic', { foreground: '#155e75', background: '#ecfeff', moduleShape: 'rounded', gradient: gradient('#164e63', '#0e7490', 25) }, ['gradient']),
  preset('earth', 'Earth', 'Organic', { foreground: '#78350f', background: '#fffbeb', moduleShape: 'soft-square', regionStyles: { ...DEFAULT_STYLE.regionStyles, alignment: { color: '#92400e', shape: 'rounded' } } }, ['region']),
  preset('pine-label', 'Pine Label', 'Organic', { foreground: '#064e3b', background: '#f0fdf4', moduleShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'label', text: 'Discover' } }, ['frame']),

  preset('social-blue', 'Social Blue', 'Social', { foreground: '#1e40af', background: '#eff6ff', moduleShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: 'Follow us' } }, ['social', 'frame']),
  preset('creator-purple', 'Creator Purple', 'Social', { foreground: '#6b21a8', background: '#faf5ff', moduleShape: 'dots', finderOuterShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'badge', text: 'Follow' } }, ['social']),
  preset('video-red', 'Video Red', 'Social', { foreground: '#991b1b', background: '#fff7ed', moduleShape: 'soft-square', frame: { ...DEFAULT_STYLE.frame, style: 'label', text: 'Watch' } }, ['social']),
  preset('community-teal', 'Community Teal', 'Social', { foreground: '#115e59', background: '#f0fdfa', moduleShape: 'connected', frame: { ...DEFAULT_STYLE.frame, style: 'sticker', text: 'Join us' } }, ['social']),
  preset('profile-ink', 'Profile Ink', 'Social', { foreground: '#111827', background: '#ffffff', moduleShape: 'rounded', finderInnerShape: 'circle', frame: { ...DEFAULT_STYLE.frame, style: 'minimal', text: '@profile' } }, ['social']),
  preset('share-gradient', 'Share Gradient', 'Social', { background: '#ffffff', foreground: '#172554', moduleShape: 'rounded', gradient: gradient('#172554', '#6d28d9', 35), frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: 'Scan & share' } }, ['social', 'gradient']),

  preset('wifi-card', 'WiFi Card', 'WiFi', { foreground: '#0f172a', background: '#f1f5f9', moduleShape: 'soft-square', frame: { ...DEFAULT_STYLE.frame, style: 'label', text: 'Connect WiFi' } }, ['wifi']),
  preset('wifi-cafe', 'WiFi Café', 'WiFi', { foreground: '#78350f', background: '#fffbeb', moduleShape: 'rounded', frame: { ...DEFAULT_STYLE.frame, style: 'sticker', text: 'Free WiFi' } }, ['wifi', 'cafe']),
  preset('wifi-hotel', 'WiFi Hotel', 'WiFi', { foreground: '#1e3a8a', background: '#eff6ff', moduleShape: 'connected', frame: { ...DEFAULT_STYLE.frame, style: 'badge', text: 'Guest WiFi' } }, ['wifi', 'hotel']),
  preset('wifi-home', 'WiFi Home', 'WiFi', { foreground: '#14532d', background: '#f0fdf4', moduleShape: 'extra-rounded', frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: 'Connect' } }, ['wifi']),
  preset('wifi-dark', 'WiFi Dark', 'WiFi', { foreground: '#f8fafc', background: '#0f172a', moduleShape: 'soft-square', frame: { ...DEFAULT_STYLE.frame, style: 'minimal', text: 'WiFi' } }, ['wifi', 'dark']),
  preset('wifi-simple', 'WiFi Simple', 'WiFi', { foreground: '#27272a', background: '#ffffff', moduleShape: 'square', frame: { ...DEFAULT_STYLE.frame, style: 'label', text: 'WiFi' } }, ['wifi', 'print']),

  preset('github-dark', 'GitHub Dark', 'Developer', { foreground: '#f8fafc', background: '#0d1117', moduleShape: 'square', finderOuterShape: 'rounded', finderInnerShape: 'square' }, ['developer', 'dark']),
  preset('terminal', 'Terminal', 'Developer', { foreground: '#86efac', background: '#052e16', moduleShape: 'pixel', finderOuterShape: 'square', finderInnerShape: 'square', moduleGap: 0 }, ['developer', 'terminal']),
  preset('syntax-blue', 'Syntax Blue', 'Developer', { foreground: '#0c4a6e', background: '#f8fafc', moduleShape: 'connected', finderOuterShape: 'square' }, ['developer']),
  preset('console-amber', 'Console Amber', 'Developer', { foreground: '#fef3c7', background: '#451a03', moduleShape: 'square', moduleGap: 0 }, ['developer', 'dark']),
  preset('matrix', 'Matrix', 'Developer', { foreground: '#bbf7d0', background: '#052e16', moduleShape: 'connected', finderOuterShape: 'rounded' }, ['developer', 'green']),
  preset('api-violet', 'API Violet', 'Developer', { foreground: '#4c1d95', background: '#f5f3ff', moduleShape: 'soft-square', frame: { ...DEFAULT_STYLE.frame, style: 'minimal', text: 'Open link' } }, ['developer', 'api']),
] as const;

export const PRESET_CATEGORIES: readonly Preset['category'][] = [
  'Minimal', 'Corporate', 'Luxury', 'Dark', 'Pastel', 'Neon', 'Organic', 'Social', 'WiFi', 'Developer',
] as const;

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((item) => item.id === id);
}
