export type RasterMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/avif';

export interface RasterDimensions {
  readonly width: number;
  readonly height: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(bytes[offset + index] ?? 0);
  return value;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function pngDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value) || ascii(bytes, 12, 4) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function jpegDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (sofMarkers.has(marker) && segmentLength >= 7) {
      return {
        height: ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0),
        width: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 25 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    if (bytes.length < 30) return null;
    return { width: 1 + readUint24LE(bytes, 24), height: 1 + readUint24LE(bytes, 27) };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;
    return { width: 1 + b0 + ((b1 & 0x3f) << 8), height: 1 + (b1 >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10) };
  }
  if (chunk === 'VP8 ') {
    if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      width: ((bytes[26] ?? 0) | ((bytes[27] ?? 0) << 8)) & 0x3fff,
      height: ((bytes[28] ?? 0) | ((bytes[29] ?? 0) << 8)) & 0x3fff,
    };
  }
  return null;
}

function gifDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (bytes.length < 10) return null;
  const signature = ascii(bytes, 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  return {
    width: (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8),
    height: (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8),
  };
}

function hasAvifBrand(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const declaredSize = view.getUint32(0, false);
  if (declaredSize === 1) return false;
  const boxSize = declaredSize === 0 ? bytes.length : declaredSize;
  if (boxSize < 16 || boxSize > bytes.length) return false;
  if (ascii(bytes, 8, 4) === 'avif' || ascii(bytes, 8, 4) === 'avis') return true;
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    const brand = ascii(bytes, offset, 4);
    if (brand === 'avif' || brand === 'avis') return true;
  }
  return false;
}

function avifDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (!hasAvifBrand(bytes)) return null;
  const limit = Math.min(bytes.length - 16, 1_000_000);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 4; index <= limit; index += 1) {
    if (ascii(bytes, index, 4) !== 'ispe' || index < 4) continue;
    const boxOffset = index - 4;
    const boxSize = view.getUint32(boxOffset, false);
    if (boxSize < 20 || boxOffset + boxSize > bytes.length) continue;
    const width = view.getUint32(index + 8, false);
    const height = view.getUint32(index + 12, false);
    if (width > 0 && height > 0) return { width, height };
  }
  return null;
}

export function inspectRasterDimensions(bytes: Uint8Array, mimeType: RasterMimeType): RasterDimensions | null {
  if (mimeType === 'image/png') return pngDimensions(bytes);
  if (mimeType === 'image/jpeg') return jpegDimensions(bytes);
  if (mimeType === 'image/webp') return webpDimensions(bytes);
  if (mimeType === 'image/gif') return gifDimensions(bytes);
  return avifDimensions(bytes);
}

export function rasterDimensionsWithinLimits(
  dimensions: RasterDimensions | null,
  maxDimension: number,
  maxPixels: number,
): boolean {
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) return false;
  if (!Number.isFinite(maxDimension) || !Number.isFinite(maxPixels) || maxDimension < 1 || maxPixels < 1) return false;
  return dimensions.width <= maxDimension
    && dimensions.height <= maxDimension
    && dimensions.width * dimensions.height <= maxPixels;
}

export function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
