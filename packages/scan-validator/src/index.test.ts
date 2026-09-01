import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '@moduqr/renderer';
import { evaluateSafety } from './index';

describe('scan safety', () => {
  it('rewards a high-contrast baseline', () => expect(evaluateSafety({ payload: 'https://example.com', style: DEFAULT_STYLE, outputWidth: 640 }).score).toBeGreaterThanOrEqual(85));
  it('penalizes failed decode', () => expect(evaluateSafety({ payload: 'hello', style: DEFAULT_STYLE, outputWidth: 640, decoded: false }).score).toBeLessThan(70));
});
