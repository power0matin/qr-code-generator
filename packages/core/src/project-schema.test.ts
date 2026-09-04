import { describe, expect, it } from 'vitest';
import { parseDesignDocument } from './project-schema';

const legacy = {
  version: 1,
  id: 'legacy-project',
  name: 'Legacy project',
  payloadType: 'url',
  payload: 'https://example.com',
  style: {
    moduleShape: 'rounded',
    finderOuterShape: 'rounded',
    finderInnerShape: 'circle',
    foreground: '#111827',
    background: '#ffffff',
    gradient: null,
    quietZone: 4,
    moduleGap: 0.08,
    errorCorrection: 'M',
    logo: {
      dataUrl: null,
      mimeType: null,
      size: 0.2,
      padding: 4,
      background: '#ffffff',
      radius: 20,
      borderWidth: 0,
      borderColor: '#ffffff',
      cutout: true,
    },
    frame: { style: 'none', text: 'Scan me', fontSize: 18, fontWeight: 600, padding: 24 },
  },
  presetId: null,
  favorite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
} as const;


function pngDataUrl(width: number, height: number): string {
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

function currentDocument(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(parseDesignDocument(legacy))) as Record<string, unknown>;
}

function currentStyle(documentValue: Record<string, unknown>): Record<string, unknown> {
  return documentValue['style'] as Record<string, unknown>;
}

describe('design document migration and validation', () => {
  it('migrates schema v1 projects into the current schema without losing the design', () => {
    const migrated = parseDesignDocument(legacy);
    expect(migrated.version).toBe(3);
    expect(migrated.style.moduleShape).toBe('rounded');
    expect(migrated.style.backgroundGradient).toBeNull();
    expect(migrated.style.finderOverrides.topLeft.outerColor).toBeNull();
    expect(migrated.style.regionStyles.timing.shape).toBeNull();
    expect(migrated.tags).toEqual([]);
    expect(migrated.revision).toBe(1);
  });


  it('migrates schema v2 projects into v3 without changing Phase 2 renderer primitives', () => {
    const v2 = currentDocument();
    v2['version'] = 2;
    delete v2['tags'];
    delete v2['revision'];
    const style = currentStyle(v2);
    delete style['regionStyles'];
    const migrated = parseDesignDocument(v2);
    expect(migrated.version).toBe(3);
    expect(migrated.style.moduleShape).toBe('rounded');
    expect(migrated.style.regionStyles.data.color).toBeNull();
    expect(migrated.tags).toEqual([]);
    expect(migrated.revision).toBe(1);
  });

  it('normalizes duplicate project tags in v3 documents', () => {
    const documentValue = currentDocument();
    documentValue['tags'] = [' Campaign ', 'campaign', 'Print'];
    expect(parseDesignDocument(documentValue).tags).toEqual(['Campaign', 'Print']);
  });

  it('rejects imported logo sizes larger than the renderer and editor support', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    style['logo'] = { ...(style['logo'] as Record<string, unknown>), size: 0.27 };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects CSS paint injection in imported colors', () => {
    const documentValue = currentDocument();
    currentStyle(documentValue)['foreground'] = 'url(https://attacker.example/paint)';
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects logo data whose declared MIME does not match its data URL', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/png',
      dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
    };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects executable or externally-referencing SVG logos in imported JSON', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    const unsafeSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect fill="url(https://attacker.example/a)"/></svg>');
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/svg+xml',
      dataUrl: `data:image/svg+xml,${unsafeSvg}`,
    };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects SVG animation elements that were not produced by the sanitizer allowlist', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    const animatedSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8"><animate attributeName="r" values="1;8" dur="1s"/></circle></svg>');
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/svg+xml',
      dataUrl: `data:image/svg+xml,${animatedSvg}`,
    };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects SVG logo documents without renderable geometry', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    const blankSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs></svg>');
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/svg+xml',
      dataUrl: `data:image/svg+xml,${blankSvg}`,
    };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });

  it('rejects imported raster logos with unsafe decoded dimensions', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/png',
      dataUrl: pngDataUrl(5000, 5000),
    };
    expect(() => parseDesignDocument(documentValue)).toThrow();
  });


  it('accepts an imported raster logo whose signature and dimensions are within limits', () => {
    const documentValue = currentDocument();
    const style = currentStyle(documentValue);
    style['logo'] = {
      ...(style['logo'] as Record<string, unknown>),
      mimeType: 'image/png',
      dataUrl: pngDataUrl(512, 512),
    };
    expect(parseDesignDocument(documentValue).style.logo.mimeType).toBe('image/png');
  });

});
