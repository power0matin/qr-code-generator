import { describe, expect, it } from 'vitest';
import { inspectRasterDimensions, rasterDimensionsWithinLimits } from './raster';

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function gifHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(10);
  bytes.set(Array.from('GIF89a', (character) => character.charCodeAt(0)));
  bytes[6] = width & 0xff;
  bytes[7] = (width >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (height >> 8) & 0xff;
  return bytes;
}

describe('raster metadata inspection', () => {
  it('reads trusted dimensions from PNG and GIF headers', () => {
    expect(inspectRasterDimensions(pngHeader(512, 384), 'image/png')).toEqual({ width: 512, height: 384 });
    expect(inspectRasterDimensions(gifHeader(320, 240), 'image/gif')).toEqual({ width: 320, height: 240 });
  });

  it('rejects MIME-spoofed or malformed image headers', () => {
    expect(inspectRasterDimensions(new TextEncoder().encode('not-a-png'), 'image/png')).toBeNull();
    const malformedPng = pngHeader(128, 128);
    malformedPng.set([0x42, 0x41, 0x44, 0x21], 12);
    expect(inspectRasterDimensions(malformedPng, 'image/png')).toBeNull();
  });

  it('enforces both edge-length and decoded-pixel limits', () => {
    expect(rasterDimensionsWithinLimits({ width: 4096, height: 3900 }, 4096, 16_000_000)).toBe(true);
    expect(rasterDimensionsWithinLimits({ width: 5000, height: 100 }, 4096, 16_000_000)).toBe(false);
    expect(rasterDimensionsWithinLimits({ width: 4096, height: 4096 }, 4096, 16_000_000)).toBe(false);
  });
});
