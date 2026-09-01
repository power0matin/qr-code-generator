import { encodeMatrix } from '@moduqr/core';
import type { QRStyle, SafetyIssue, SafetyReport } from '@moduqr/shared';

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

export interface SafetyInput {
  readonly payload: string;
  readonly style: QRStyle;
  readonly outputWidth: number;
  readonly decoded?: boolean | null;
}

export function evaluateSafety(input: SafetyInput): SafetyReport {
  const matrix = encodeMatrix(input.payload, input.style.errorCorrection);
  const issues: SafetyIssue[] = [];
  const quiet = input.style.quietZone;
  const effectiveModules = matrix.size + quiet * 2;
  const modulePixels = input.outputWidth / effectiveModules;
  const baseContrast = contrastRatio(input.style.foreground, input.style.background);

  if (baseContrast !== null && baseContrast < 4.5) {
    issues.push({ code: 'LOW_CONTRAST', severity: baseContrast < 2.5 ? 'error' : 'warning', message: `Foreground/background contrast is ${baseContrast.toFixed(2)}:1.`, fix: 'Increase foreground/background contrast.', penalty: baseContrast < 2.5 ? 28 : 15 });
  }
  if (input.style.gradient) {
    const ratios = input.style.gradient.stops.map((stop) => contrastRatio(stop.color, input.style.background)).filter((ratio): ratio is number => ratio !== null);
    if (ratios.length > 0 && Math.min(...ratios) < 4.5) {
      issues.push({ code: 'GRADIENT_CONTRAST', severity: 'warning', message: 'At least one gradient stop has weak contrast.', fix: 'Darken/lighten the weakest gradient stop.', penalty: 12 });
    }
  }
  if (quiet < 4) issues.push({ code: 'QUIET_ZONE', severity: 'error', message: 'Quiet zone is below the QR recommendation.', fix: 'Use at least 4 modules of quiet zone.', penalty: 25 });
  if (matrix.version >= 15) issues.push({ code: 'HIGH_DENSITY', severity: matrix.version >= 25 ? 'error' : 'warning', message: `Payload requires a dense version ${matrix.version} QR.`, fix: 'Shorten the payload or increase output size.', penalty: matrix.version >= 25 ? 18 : 9 });
  if (modulePixels < 5) issues.push({ code: 'SMALL_MODULES', severity: modulePixels < 3 ? 'error' : 'warning', message: `Each module is only ${modulePixels.toFixed(1)}px at this output size.`, fix: 'Increase export dimensions.', penalty: modulePixels < 3 ? 24 : 12 });
  if (input.style.logo.dataUrl && input.style.logo.size > 0.24) issues.push({ code: 'LOGO_OBSTRUCTION', severity: 'warning', message: 'The logo occupies a large center region.', fix: 'Reduce logo size below 24% or use High error correction.', penalty: 12 });
  if (input.style.finderOuterShape === 'circle' || input.style.moduleShape === 'diamond' || input.style.moduleGap > 0.18) issues.push({ code: 'SHAPE_RISK', severity: 'warning', message: "This styling choice removes more of the QR's standard geometry.", fix: 'Prefer square/rounded finder frames and moderate module gaps when reliability matters most.', penalty: 8 });
  if (input.decoded === false) issues.push({ code: 'DECODE_FAILED', severity: 'error', message: 'The rendered QR could not be decoded.', fix: 'Increase contrast, quiet zone, or reduce styling/logo size.', penalty: 45 });

  const score = Math.max(0, Math.round(100 - issues.reduce((sum, issue) => sum + issue.penalty, 0)));
  const grade: SafetyReport['grade'] = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Risky' : 'Poor';
  return { score, grade, issues, decoded: input.decoded ?? null };
}
