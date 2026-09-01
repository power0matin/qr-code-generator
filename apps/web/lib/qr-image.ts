'use client';

import decodeQR from 'qr/decode.js';

export async function svgToCanvas(svg: string, width: number, transparent = false, compositeBackground: string | null = null): Promise<HTMLCanvasElement> {
  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const sourceWidth = Number(viewBox?.[1] ?? 640);
  const sourceHeight = Number(viewBox?.[2] ?? 640);
  const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth));
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: transparent });
    if (!context) throw new Error('Canvas is unavailable.');
    if (compositeBackground) { context.fillStyle = compositeBackground; context.fillRect(0, 0, width, height); }
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to rasterize QR image.'));
    image.src = src;
  });
}

export function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  try {
    return decodeQR({ width: image.width, height: image.height, data: image.data });
  } catch {
    return null;
  }
}

export async function decodeImageFile(file: File): Promise<string> {
  const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
  if (!supported.has(file.type)) throw new Error('Choose a PNG, JPEG, WebP, GIF, or AVIF image.');
  if (file.size > 12_000_000) throw new Error('Image must be 12 MB or smaller.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const max = 1800;
    const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const decoded = decodeCanvas(canvas);
    if (!decoded) throw new Error('No readable QR code was found in this image.');
    return decoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
