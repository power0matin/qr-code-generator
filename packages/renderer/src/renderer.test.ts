import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, renderQR } from './index';

describe('renderer', () => {
  it('renders an SVG with a quiet zone', () => {
    const result = renderQR('https://example.com', DEFAULT_STYLE, 640);
    expect(result.svg.startsWith('<svg')).toBe(true);
    expect(result.matrixSize).toBeGreaterThanOrEqual(21);
    expect(result.modulePixels).toBeGreaterThan(0);
  });

  it('does not inject frame text as markup', () => {
    const result = renderQR('hello', { ...DEFAULT_STYLE, frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: '<script>alert(1)</script>' } });
    expect(result.svg).not.toContain('<script>');
    expect(result.svg).toContain('&lt;script&gt;');
  });
});
