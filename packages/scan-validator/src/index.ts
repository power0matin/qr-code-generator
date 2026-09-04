import { encodeMatrix } from '@moduqr/core';
import type { QRStyle, SafetyIssue, SafetyReport, SafetySimulationResult } from '@moduqr/shared';

interface RGB { readonly r: number; readonly g: number; readonly b: number }

function parseHex(value: string): RGB | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return null;
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  return { r: Number.parseInt(full.slice(0, 2), 16), g: Number.parseInt(full.slice(2, 4), 16), b: Number.parseInt(full.slice(4, 6), 16) };
}

function luminance(rgb: RGB): number {
  const channel = (n: number): number => {
    const s = n / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return null;
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function minimumContrast(foregrounds: readonly string[], backgrounds: readonly string[]): number | null {
  const values = foregrounds
    .flatMap((foreground) => backgrounds.map((background) => contrastRatio(foreground, background)))
    .filter((ratio): ratio is number => ratio !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

function resolvedFinderColors(style: QRStyle): readonly string[] {
  return [
    style.finderOverrides.topLeft.outerColor ?? style.foreground,
    style.finderOverrides.topLeft.innerColor ?? style.foreground,
    style.finderOverrides.topRight.outerColor ?? style.foreground,
    style.finderOverrides.topRight.innerColor ?? style.foreground,
    style.finderOverrides.bottomLeft.outerColor ?? style.foreground,
    style.finderOverrides.bottomLeft.innerColor ?? style.foreground,
  ];
}

function resolvedRegionColors(style: QRStyle): readonly string[] {
  return [style.regionStyles.data.color, style.regionStyles.timing.color, style.regionStyles.alignment.color]
    .filter((color): color is string => color !== null);
}

export interface SafetyInput {
  readonly payload: string;
  readonly style: QRStyle;
  readonly outputWidth: number;
  readonly renderWidth?: number;
  readonly decoded?: boolean | null;
  readonly simulations?: readonly SafetySimulationResult[] | undefined;
}

export function evaluateSafety(input: SafetyInput): SafetyReport {
  let matrix: ReturnType<typeof encodeMatrix>;
  try {
    matrix = encodeMatrix(input.payload, input.style.errorCorrection);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The payload could not be encoded as a QR code.';
    const issue: SafetyIssue = {
      code: 'ENCODE_FAILED',
      severity: 'error',
      message: `QR encoding failed: ${message}`,
      fix: 'Shorten the payload or choose a payload format that fits within QR capacity.',
      penalty: 100,
    };
    return { score: 0, grade: 'Poor', issues: [issue], decoded: false };
  }

  const issues: SafetyIssue[] = [];
  const quiet = input.style.quietZone;
  const outputWidth = Number.isFinite(input.outputWidth) && input.outputWidth > 0 ? input.outputWidth : 640;
  const requestedRenderWidth = input.renderWidth;
  const renderWidth = typeof requestedRenderWidth === 'number' && Number.isFinite(requestedRenderWidth) && requestedRenderWidth > 0 ? requestedRenderWidth : 640;
  const effectiveModules = matrix.size + quiet * 2;
  const modulePixels = outputWidth / effectiveModules;
  const backgroundColors = input.style.backgroundGradient?.stops.map((stop) => stop.color) ?? [input.style.background];
  const moduleColors = input.style.gradient?.stops.map((stop) => stop.color) ?? [input.style.foreground];
  const moduleContrast = minimumContrast(moduleColors, backgroundColors);

  if (input.style.gradient || input.style.backgroundGradient) {
    if (moduleContrast !== null && moduleContrast < 4.5) {
      issues.push({ code: 'GRADIENT_CONTRAST', severity: moduleContrast < 2.5 ? 'error' : 'warning', message: `A module/background gradient pairing falls to ${moduleContrast.toFixed(2)}:1 contrast.`, fix: 'Adjust the weakest gradient stop or simplify the background.', penalty: moduleContrast < 2.5 ? 24 : 12 });
    }
  } else if (moduleContrast !== null && moduleContrast < 4.5) {
    issues.push({ code: 'LOW_CONTRAST', severity: moduleContrast < 2.5 ? 'error' : 'warning', message: `Foreground/background contrast is ${moduleContrast.toFixed(2)}:1.`, fix: 'Increase contrast between modules and the background.', penalty: moduleContrast < 2.5 ? 28 : 15 });
  }

  const finderContrast = minimumContrast(resolvedFinderColors(input.style), backgroundColors);
  if (finderContrast !== null && finderContrast < 4.5) {
    issues.push({ code: 'FINDER_CONTRAST', severity: finderContrast < 2.5 ? 'error' : 'warning', message: `A finder/background pairing falls to ${finderContrast.toFixed(2)}:1 contrast.`, fix: 'Use higher-contrast finder colors so all three eyes remain easy to locate.', penalty: finderContrast < 2.5 ? 24 : 12 });
  }

  const regionColors = resolvedRegionColors(input.style);
  const regionContrast = regionColors.length > 0 ? minimumContrast(regionColors, backgroundColors) : null;
  if (regionContrast !== null && regionContrast < 4.5) {
    issues.push({ code: 'REGION_CONTRAST', severity: regionContrast < 2.5 ? 'error' : 'warning', message: `A per-region module color falls to ${regionContrast.toFixed(2)}:1 contrast.`, fix: 'Reset the low-contrast region color or choose a darker/lighter value.', penalty: regionContrast < 2.5 ? 24 : 12 });
  }

  if (quiet < 4) issues.push({ code: 'QUIET_ZONE', severity: 'error', message: 'Quiet zone is below the QR recommendation.', fix: 'Use at least 4 modules of quiet zone.', penalty: 25 });
  if (matrix.version >= 15) issues.push({ code: 'HIGH_DENSITY', severity: matrix.version >= 25 ? 'error' : 'warning', message: `Payload requires a dense version ${matrix.version} QR.`, fix: 'Shorten the payload or increase output size.', penalty: matrix.version >= 25 ? 18 : 9 });
  if (modulePixels < 5) issues.push({ code: 'SMALL_MODULES', severity: modulePixels < 3 ? 'error' : 'warning', message: `Each module is only ${modulePixels.toFixed(1)}px at this output size.`, fix: 'Increase export dimensions.', penalty: modulePixels < 3 ? 24 : 12 });

  if (input.style.logo.dataUrl) {
    const logoSize = Number.isFinite(input.style.logo.size) ? Math.max(0, input.style.logo.size) : 0;
    const logoPadding = Number.isFinite(input.style.logo.padding) ? Math.max(0, input.style.logo.padding) : 0;
    const logoBorderWidth = Number.isFinite(input.style.logo.borderWidth) ? Math.max(0, input.style.logo.borderWidth) : 0;
    const effectiveLogoFraction = logoSize + ((logoPadding * 2 + logoBorderWidth) / renderWidth);
    const tooLarge = effectiveLogoFraction > 0.24;
    const noCutout = !input.style.logo.cutout;
    const lowEcc = input.style.errorCorrection !== 'H';
    if (tooLarge || noCutout || lowEcc) {
      const reasons = [tooLarge ? 'large logo footprint' : null, noCutout ? 'no module cutout' : null, lowEcc ? 'error correction below High' : null].filter((reason): reason is string => reason !== null).join(', ');
      issues.push({ code: 'LOGO_OBSTRUCTION', severity: tooLarge && noCutout ? 'error' : 'warning', message: `Logo settings increase obstruction risk (${reasons}).`, fix: 'Use High error correction, keep the full logo box compact, and enable module cutout.', penalty: tooLarge && noCutout ? 22 : 12 });
    }
  }

  const finderOverrides = [input.style.finderOverrides.topLeft, input.style.finderOverrides.topRight, input.style.finderOverrides.bottomLeft] as const;
  const customCircularFinder = finderOverrides.some((override) => override.outerShape === 'circle');
  const riskyRegionShape = [input.style.regionStyles.data.shape, input.style.regionStyles.timing.shape, input.style.regionStyles.alignment.shape]
    .some((shape) => shape === 'diamond' || shape === 'fluid' || shape === 'circle' || shape === 'dots');
  if (input.style.finderOuterShape === 'circle' || customCircularFinder || input.style.moduleShape === 'diamond' || input.style.moduleShape === 'fluid' || input.style.moduleGap > 0.18 || riskyRegionShape) {
    issues.push({ code: 'SHAPE_RISK', severity: 'warning', message: "This styling choice removes more of the QR's standard geometry.", fix: 'Use connected/rounded modules, moderate gaps, and non-circular outer finders when reliability matters most.', penalty: input.style.moduleShape === 'fluid' || riskyRegionShape ? 7 : 8 });
  }
  if (input.decoded === false) issues.push({ code: 'DECODE_FAILED', severity: 'error', message: 'The rendered QR could not be decoded.', fix: 'Increase contrast, quiet zone, or reduce styling/logo size.', penalty: 45 });

  const failedSimulations = input.simulations?.filter((result) => !result.decoded && result.kind !== 'baseline') ?? [];
  if (failedSimulations.length > 0) {
    const labels = failedSimulations.map((result) => result.label).join(', ');
    issues.push({ code: 'SIMULATION_FAILED', severity: failedSimulations.length >= 3 ? 'error' : 'warning', message: `Stress-test decoding failed under: ${labels}.`, fix: 'Run Auto Fix or simplify styling until the QR survives representative print/camera degradation.', penalty: Math.min(30, 7 * failedSimulations.length) });
  }

  const score = Math.max(0, Math.round(100 - issues.reduce((sum, issue) => sum + issue.penalty, 0)));
  const grade: SafetyReport['grade'] = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Risky' : 'Poor';
  return { score, grade, issues, decoded: input.decoded ?? null };
}

/**
 * Produces a conservative scan-first style. It intentionally changes only
 * design properties that the safety evaluator can identify as risky and keeps
 * content/project metadata untouched.
 */
export function autoFixStyle(style: QRStyle, report: SafetyReport): QRStyle {
  const codes = new Set(report.issues.map((issue) => issue.code));
  let next: QRStyle = style;

  if (codes.has('LOW_CONTRAST') || codes.has('GRADIENT_CONTRAST') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED')) {
    next = { ...next, foreground: '#111827', background: '#ffffff', gradient: null, backgroundGradient: null };
  }

  if (codes.has('FINDER_CONTRAST') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED')) {
    const reset = { outerShape: null, innerShape: null, outerColor: null, innerColor: null } as const;
    next = { ...next, finderOuterShape: 'rounded', finderInnerShape: 'square', finderOverrides: { topLeft: reset, topRight: reset, bottomLeft: reset } };
  }

  if (codes.has('REGION_CONTRAST') || codes.has('SHAPE_RISK') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED')) {
    const resetRegion = { color: null, shape: null } as const;
    next = { ...next, regionStyles: { data: resetRegion, timing: resetRegion, alignment: resetRegion } };
  }

  if (codes.has('QUIET_ZONE') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED')) {
    next = { ...next, quietZone: Math.max(4, next.quietZone) };
  }

  if (codes.has('SHAPE_RISK') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED')) {
    next = { ...next, moduleShape: 'rounded', moduleGap: Math.min(next.moduleGap, 0.08), finderOuterShape: 'rounded' };
  }

  if (next.logo.dataUrl && (codes.has('LOGO_OBSTRUCTION') || codes.has('DECODE_FAILED') || codes.has('SIMULATION_FAILED'))) {
    next = {
      ...next,
      errorCorrection: 'H',
      logo: {
        ...next.logo,
        size: Math.min(next.logo.size, 0.18),
        padding: Math.min(next.logo.padding, 4),
        borderWidth: Math.min(next.logo.borderWidth, 2),
        cutout: true,
      },
    };
  }

  return next;
}
