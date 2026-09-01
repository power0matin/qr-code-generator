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

  it('renders neighbour-aware connected modules as paths', () => {
    const result = renderQR('https://example.com/connected', { ...DEFAULT_STYLE, moduleShape: 'connected' });
    expect(result.svg).toContain('<path d="M ');
  });

  it('supports independent finder shapes and colors', () => {
    const result = renderQR('https://example.com/eyes', {
      ...DEFAULT_STYLE,
      finderOverrides: {
        ...DEFAULT_STYLE.finderOverrides,
        topRight: {
          outerShape: 'circle',
          innerShape: 'square',
          outerColor: '#ff0000',
          innerColor: '#00aa00',
        },
      },
    });
    expect(result.svg).toContain('#ff0000');
    expect(result.svg).toContain('#00aa00');
  });

  it('keeps finder patterns solid when module gradients are enabled', () => {
    const result = renderQR('https://example.com/gradient-finders', {
      ...DEFAULT_STYLE,
      gradient: {
        type: 'linear',
        angle: 45,
        stops: [
          { offset: 0, color: '#111827' },
          { offset: 0.5, color: '#312e81' },
          { offset: 1, color: '#5b21b6' },
        ],
      },
    });
    expect(result.svg).toContain('fill="url(#moduqr-module-gradient)"');
    expect(result.svg).toContain('stroke="#111827"');
  });

  it('renders independent module and background gradients', () => {
    const result = renderQR('https://example.com/gradients', {
      ...DEFAULT_STYLE,
      gradient: {
        type: 'linear',
        angle: 20,
        stops: [
          { offset: 0, color: '#111827' },
          { offset: 0.5, color: '#312e81' },
          { offset: 1, color: '#5b21b6' },
        ],
      },
      backgroundGradient: {
        type: 'radial',
        angle: 0,
        stops: [
          { offset: 0, color: '#ffffff' },
          { offset: 1, color: '#f5f3ff' },
        ],
      },
    });
    expect(result.svg).toContain('id="moduqr-module-gradient"');
    expect(result.svg).toContain('id="moduqr-background-gradient"');
  });
});
