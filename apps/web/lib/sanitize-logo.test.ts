import { describe, expect, it } from 'vitest';
import { sanitizeLogoFile } from './sanitize-logo';

function svgFile(source: string, name = 'logo.svg'): File {
  return new File([source], name, { type: 'image/svg+xml' });
}

function decodedSvg(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Expected an SVG data URL.');
  return decodeURIComponent(dataUrl.slice(comma + 1));
}

describe('SVG logo sanitization', () => {
  it('reconstructs only the allowlisted SVG subset and keeps local paint references', async () => {
    const result = await sanitizeLogoFile(svgFile(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/></svg>',
    ));
    const source = decodedSvg(result.dataUrl);
    expect(result.mimeType).toBe('image/svg+xml');
    expect(source).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(source).toContain('fill="url(#g)"');
    expect(source).toContain('<rect');
  });

  it('drops unsafe subtrees and external paint values without parsing untrusted markup into the DOM', async () => {
    const result = await sanitizeLogoFile(svgFile(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><script>alert(1)</script><rect width="40" height="40" fill="url(https://attacker.example/paint)"/><circle cx="20" cy="20" r="12" fill="#111827"/></svg>',
    ));
    const source = decodedSvg(result.dataUrl);
    expect(source).not.toContain('<script');
    expect(source).not.toContain('alert(1)');
    expect(source).not.toContain('attacker.example');
    expect(source).toContain('<circle');
  });

  it('rejects declarations, unbalanced markup, and SVGs without renderable geometry', async () => {
    await expect(sanitizeLogoFile(svgFile('<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>'))).rejects.toThrow(/doctypes/i);
    await expect(sanitizeLogoFile(svgFile('<svg xmlns="http://www.w3.org/2000/svg"><g><circle r="5"/></svg>'))).rejects.toThrow(/mismatched|unbalanced/i);
    await expect(sanitizeLogoFile(svgFile('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs></svg>'))).rejects.toThrow(/renderable geometry/i);
  });
});
