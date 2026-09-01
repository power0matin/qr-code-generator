import encodeQR from 'qr';
import type { ErrorCorrectionLevel } from '@moduqr/shared';

export interface QRMatrix {
  readonly modules: readonly (readonly boolean[])[];
  readonly size: number;
  readonly version: number;
}

export function encodeMatrix(payload: string, ecc: ErrorCorrectionLevel = 'M'): QRMatrix {
  if (!payload) throw new Error('QR payload cannot be empty.');
  const eccMap: Record<ErrorCorrectionLevel, 'low' | 'medium' | 'quartile' | 'high'> = { L: 'low', M: 'medium', Q: 'quartile', H: 'high' };
  const bordered = encodeQR(payload, 'raw', { ecc: eccMap[ecc], border: 1 });
  if (!Array.isArray(bordered) || bordered.length < 3) throw new Error('QR encoder returned an invalid matrix.');
  const modules = bordered.slice(1, -1).map((row) => row.slice(1, -1));
  const size = modules.length;
  if (size < 21 || modules.some((row) => row.length !== size)) throw new Error('QR encoder returned a malformed matrix.');
  return { modules, size, version: Math.floor((size - 17) / 4) };
}

export function estimateDensity(payload: string): number {
  const bytes = new TextEncoder().encode(payload).byteLength;
  return Math.min(1, bytes / 1800);
}

export function estimateEmbeddedDataCapacity(dataBytes: number, ecc: ErrorCorrectionLevel): {
  readonly base64Bytes: number;
  readonly practicalLimit: number;
  readonly fitsPracticalLimit: boolean;
} {
  const base64Bytes = Math.ceil(dataBytes / 3) * 4;
  const practicalLimits: Record<ErrorCorrectionLevel, number> = { L: 1800, M: 1400, Q: 1000, H: 750 };
  const practicalLimit = practicalLimits[ecc] ?? practicalLimits.M;
  return { base64Bytes, practicalLimit, fitsPracticalLimit: base64Bytes <= practicalLimit };
}
