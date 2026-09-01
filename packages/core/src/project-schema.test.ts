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

describe('design document migration', () => {
  it('migrates schema v1 projects into the current schema without losing the design', () => {
    const migrated = parseDesignDocument(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.style.moduleShape).toBe('rounded');
    expect(migrated.style.backgroundGradient).toBeNull();
    expect(migrated.style.finderOverrides.topLeft.outerColor).toBeNull();
  });
});
