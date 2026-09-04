import { describe, expect, it } from 'vitest';
import { PRESETS } from './index';

describe('professional presets', () => {
  it('ships at least 50 unique data-defined presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
  });
  it('covers multiple searchable categories and tags', () => {
    expect(new Set(PRESETS.map((preset) => preset.category)).size).toBeGreaterThanOrEqual(8);
    expect(PRESETS.every((preset) => preset.tags.length > 0)).toBe(true);
  });

  it.each(PRESETS.map((preset) => [preset.id, preset] as const))('%s uses a minimum four-module quiet zone', (_id, preset) => {
    expect(preset.style.quietZone).toBeGreaterThanOrEqual(4);
  });
});
