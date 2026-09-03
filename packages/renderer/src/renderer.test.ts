import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE, renderQR } from './index';

function pngDataUrl(width = 1, height = 1): string {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

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

  it('keeps the frame fully outside the QR square and quiet zone', () => {
    const result = renderQR('https://example.com/frame', { ...DEFAULT_STYLE, frame: { ...DEFAULT_STYLE.frame, style: 'rounded', text: 'Scan me' } }, 640);
    const frameY = result.svg.match(/data-role="frame"[^>]* y="([\d.]+)"/)?.[1];
    expect(Number(frameY)).toBeGreaterThanOrEqual(640);
    expect(result.viewBoxHeight).toBeGreaterThan(result.viewBoxWidth);
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


  it('expands the center cutout when logo padding increases', () => {
    const logoData = pngDataUrl();
    const style = {
      ...DEFAULT_STYLE,
      errorCorrection: 'H' as const,
      logo: {
        ...DEFAULT_STYLE.logo,
        dataUrl: logoData,
        mimeType: 'image/png' as const,
        size: 0.18,
        cutout: true,
      },
    };
    const compact = renderQR('https://example.com/logo-padding', { ...style, logo: { ...style.logo, padding: 0 } }, 640);
    const padded = renderQR('https://example.com/logo-padding', { ...style, logo: { ...style.logo, padding: 14 } }, 640);
    const moduleCount = (svg: string): number => {
      const markup = svg.match(/<g data-role="modules">([\s\S]*?)<\/g>/)?.[1] ?? '';
      return (markup.match(/<(?:rect|circle|path)\b/g) ?? []).length;
    };
    expect(moduleCount(padded.svg)).toBeLessThan(moduleCount(compact.svg));
  });

  it('omits SVG runtime logos that contain no renderable geometry', () => {
    const blankSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs></svg>');
    const result = renderQR('https://example.com/blank-logo', {
      ...DEFAULT_STYLE,
      logo: {
        ...DEFAULT_STYLE.logo,
        mimeType: 'image/svg+xml',
        dataUrl: `data:image/svg+xml,${blankSvg}`,
      },
    });
    expect(result.svg).not.toContain('<image ');
  });

  it('falls back from unsafe runtime paint values and omits unsafe runtime logos', () => {
    const unsafeSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const payload = 'https://example.com/runtime-hardening';
    const result = renderQR(payload, {
      ...DEFAULT_STYLE,
      foreground: 'url(https://attacker.example/paint)',
      logo: {
        ...DEFAULT_STYLE.logo,
        mimeType: 'image/svg+xml',
        dataUrl: `data:image/svg+xml,${unsafeSvg}`,
      },
    });
    const safeBaseline = renderQR(payload, DEFAULT_STYLE);
    expect(result.svg).toContain('#111827');
    expect(result.svg).not.toContain('attacker.example');
    expect(result.svg).not.toContain('<image ');
    expect(result.svg).toBe(safeBaseline.svg);
  });

  it('clamps unsafe runtime numeric values and ignores malformed gradients', () => {
    const result = renderQR('https://example.com/runtime-numbers', {
      ...DEFAULT_STYLE,
      quietZone: Number.NaN,
      moduleGap: Number.POSITIVE_INFINITY,
      gradient: { type: 'linear', angle: Number.NaN, stops: [] },
      logo: { ...DEFAULT_STYLE.logo, size: Number.NaN, padding: Number.POSITIVE_INFINITY, radius: Number.NaN },
      frame: { ...DEFAULT_STYLE.frame, style: 'rounded', fontSize: Number.POSITIVE_INFINITY, padding: Number.NaN },
    });
    expect(result.svg).not.toContain('NaN');
    expect(result.svg).not.toContain('Infinity');
    expect(result.svg).not.toContain('id="moduqr-module-gradient"');
  });

  it('omits runtime logos whose MIME metadata does not match the data URL', () => {
    const result = renderQR('https://example.com/mime-mismatch', {
      ...DEFAULT_STYLE,
      logo: {
        ...DEFAULT_STYLE.logo,
        mimeType: 'image/jpeg',
        dataUrl: pngDataUrl(),
      },
    });
    expect(result.svg).not.toContain('<image ');
  });


  it('omits oversized runtime raster logos even when the MIME prefix looks valid', () => {
    const result = renderQR('https://example.com/oversized-runtime-logo', {
      ...DEFAULT_STYLE,
      logo: {
        ...DEFAULT_STYLE.logo,
        mimeType: 'image/png',
        dataUrl: pngDataUrl(5000, 5000),
      },
    });
    expect(result.svg).not.toContain('<image ');
  });

});
