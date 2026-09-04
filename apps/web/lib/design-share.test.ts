import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '@moduqr/renderer';
import { createDesignShareUrl, readDesignShareFromHash } from './design-share';

describe('design-only sharing', () => {
  it('round-trips styling without payload or embedded logo bytes', () => {
    window.history.replaceState(null, '', '/generator');
    const style = {
      ...DEFAULT_STYLE,
      foreground: '#172554',
      logo: { ...DEFAULT_STYLE.logo, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', mimeType: 'image/png' as const },
    };
    const url = createDesignShareUrl(style, 'minimal-ink');
    expect(url).not.toContain('example.com');
    expect(url).not.toContain('iVBOR');
    const shared = readDesignShareFromHash(new URL(url).hash);
    expect(shared?.style.foreground).toBe('#172554');
    expect(shared?.style.logo.dataUrl).toBeNull();
    expect(shared?.presetId).toBe('minimal-ink');
  });

  it('rejects unsafe style values from the URL', () => {
    const payload = { v: 1, presetId: null, style: { ...DEFAULT_STYLE, foreground: 'url(https://attacker.example)' } };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    expect(() => readDesignShareFromHash(`#design=${encoded}`)).toThrow();
  });
});
