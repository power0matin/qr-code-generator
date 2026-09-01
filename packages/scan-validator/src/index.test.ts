import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '@moduqr/renderer';
import { contrastRatio, evaluateSafety } from './index';

describe('scan safety', () => {
  it('calculates WCAG-style contrast for hex colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('penalizes a failed rendered decode', () => {
    const report = evaluateSafety({ payload: 'https://example.com', style: DEFAULT_STYLE, outputWidth: 640, decoded: false });
    expect(report.issues.some((issue) => issue.code === 'DECODE_FAILED')).toBe(true);
    expect(report.score).toBeLessThan(70);
  });

  it('checks custom finder colors against background gradients', () => {
    const report = evaluateSafety({
      payload: 'https://example.com',
      outputWidth: 640,
      style: {
        ...DEFAULT_STYLE,
        backgroundGradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#f8fafc' },
          ],
        },
        finderOverrides: {
          ...DEFAULT_STYLE.finderOverrides,
          topLeft: { ...DEFAULT_STYLE.finderOverrides.topLeft, outerColor: '#f1f5f9' },
        },
      },
    });
    expect(report.issues.some((issue) => issue.code === 'FINDER_CONTRAST')).toBe(true);
  });
});
