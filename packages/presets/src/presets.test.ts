import { describe, expect, it } from 'vitest';
import { PRESETS } from './index';

describe('Phase 1 presets', () => {
  it('ships at least 20 unique data-defined presets', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
  });
  it.each(PRESETS.map((preset) => [preset.id, preset] as const))('%s uses a minimum four-module quiet zone', (_id, preset) => {
    expect(preset.style.quietZone).toBeGreaterThanOrEqual(4);
  });
});
