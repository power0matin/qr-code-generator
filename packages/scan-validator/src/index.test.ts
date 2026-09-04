import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '@moduqr/renderer';
import { autoFixStyle, contrastRatio, evaluateSafety } from './index';

describe('scan safety', () => {
  it('calculates WCAG-style contrast for hex colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('penalizes a failed rendered decode', () => {
    const report = evaluateSafety({ payload: 'https://example.com', style: DEFAULT_STYLE, outputWidth: 640, decoded: false });
    expect(report.issues.some((issue) => issue.code === 'DECODE_FAILED')).toBe(true);
    expect(report.score).toBeLessThan(70);
  });

  it('returns a controlled encode failure for payloads beyond QR capacity', () => {
    const report = evaluateSafety({ payload: 'x'.repeat(50_000), style: DEFAULT_STYLE, outputWidth: 640, decoded: null });
    expect(report.score).toBe(0);
    expect(report.grade).toBe('Poor');
    expect(report.issues.some((issue) => issue.code === 'ENCODE_FAILED')).toBe(true);
  });

  it('includes logo padding in obstruction risk', () => {
    const report = evaluateSafety({
      payload: 'https://example.com',
      outputWidth: 640,
      style: {
        ...DEFAULT_STYLE,
        errorCorrection: 'H',
        logo: {
          ...DEFAULT_STYLE.logo,
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
          mimeType: 'image/png',
          size: 0.2,
          padding: 14,
          cutout: true,
        },
      },
    });
    expect(report.issues.some((issue) => issue.code === 'LOGO_OBSTRUCTION')).toBe(true);
  });

  it('keeps logo obstruction geometry independent from raster export resolution', () => {
    const style = {
      ...DEFAULT_STYLE,
      errorCorrection: 'H' as const,
      logo: {
        ...DEFAULT_STYLE.logo,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        mimeType: 'image/png' as const,
        size: 0.2,
        padding: 16,
        cutout: true,
      },
    };

    const small = evaluateSafety({ payload: 'https://example.com', style, outputWidth: 320 });
    const large = evaluateSafety({ payload: 'https://example.com', style, outputWidth: 1600 });
    const hasLogoRisk = (report: ReturnType<typeof evaluateSafety>): boolean => report.issues.some((issue) => issue.code === 'LOGO_OBSTRUCTION');

    expect(hasLogoRisk(small)).toBe(true);
    expect(hasLogoRisk(large)).toBe(true);
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

  it('checks inherited finder foreground even when module gradients are dark', () => {
    const report = evaluateSafety({
      payload: 'https://example.com',
      outputWidth: 640,
      style: {
        ...DEFAULT_STYLE,
        foreground: '#f1f5f9',
        gradient: {
          type: 'linear',
          angle: 45,
          stops: [
            { offset: 0, color: '#111827' },
            { offset: 1, color: '#312e81' },
          ],
        },
        backgroundGradient: {
          type: 'linear',
          angle: 0,
          stops: [
            { offset: 0, color: '#ffffff' },
            { offset: 1, color: '#f8fafc' },
          ],
        },
      },
    });
    expect(report.issues.some((issue) => issue.code === 'FINDER_CONTRAST')).toBe(true);
  });

  it('Auto Fix removes deterministic styling risks and improves the score', () => {
    const risky = {
      ...DEFAULT_STYLE,
      foreground: '#777777',
      background: '#888888',
      moduleShape: 'fluid' as const,
      moduleGap: 0.25,
      regionStyles: {
        data: { color: '#777777', shape: 'fluid' as const },
        timing: { color: '#777777', shape: 'circle' as const },
        alignment: { color: '#777777', shape: 'diamond' as const },
      },
    };
    const before = evaluateSafety({ payload: 'https://example.com/auto-fix', style: risky, outputWidth: 640, decoded: false });
    const fixed = autoFixStyle(risky, before);
    const after = evaluateSafety({ payload: 'https://example.com/auto-fix', style: fixed, outputWidth: 640, decoded: true });
    expect(after.score).toBeGreaterThan(before.score);
    expect(fixed.gradient).toBeNull();
    expect(fixed.regionStyles.timing.shape).toBeNull();
    expect(fixed.moduleGap).toBeLessThanOrEqual(0.08);
  });

  it('penalizes failed Phase 2 stress simulations', () => {
    const report = evaluateSafety({
      payload: 'https://example.com/simulations',
      style: DEFAULT_STYLE,
      outputWidth: 640,
      decoded: true,
      simulations: [
        { kind: 'baseline', label: 'Baseline', decoded: true },
        { kind: 'blur', label: 'Blur', decoded: false },
        { kind: 'rotation', label: 'Rotation', decoded: false },
      ],
    });
    expect(report.issues.some((issue) => issue.code === 'SIMULATION_FAILED')).toBe(true);
  });

});
