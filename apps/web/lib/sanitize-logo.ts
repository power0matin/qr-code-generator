'use client';

import { inspectRasterDimensions, rasterDimensionsWithinLimits, type RasterMimeType } from '@moduqr/core';

const SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask']);
const SVG_ATTRS = new Set(['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'clip-path', 'mask']);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const RENDERABLE_SVG_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

type SafeLogoMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';

const MAX_LOGO_DIMENSION = 4096;
const MAX_LOGO_PIXELS = 16_000_000;

function assertSafeRasterDimensions(bytes: Uint8Array, mimeType: Exclude<SafeLogoMime, 'image/svg+xml'>): void {
  const dimensions = inspectRasterDimensions(bytes, mimeType as RasterMimeType);
  if (!dimensions) throw new Error('The logo file contents do not match its declared image type.');
  if (!rasterDimensionsWithinLimits(dimensions, MAX_LOGO_DIMENSION, MAX_LOGO_PIXELS)) {
    throw new Error('Logo dimensions are too large. Use an image up to 4096×4096 and 16 megapixels.');
  }
}

function isLocalPaintReference(value: string): boolean {
  const matches = [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)];
  if (matches.length === 0) return true;
  return matches.every((match) => /^#[A-Za-z_][\w:.-]*$/.test(match[2]?.trim() ?? ''));
}

function isUnsafeAttribute(name: string, value: string): boolean {
  const lower = name.toLowerCase();
  if (!SVG_ATTRS.has(name) || lower.startsWith('on')) return true;
  if (lower === 'xmlns') return value !== SVG_NAMESPACE;
  if (/javascript:|data:text\/html|file:|ftp:|https?:/i.test(value)) return true;
  return !isLocalPaintReference(value);
}

async function assertRasterFile(file: File, mimeType: Exclude<SafeLogoMime, 'image/svg+xml'>): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertSafeRasterDimensions(bytes, mimeType);
}

export async function sanitizeLogoFile(file: File): Promise<{ readonly dataUrl: string; readonly mimeType: SafeLogoMime }> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
  if (!allowed.includes(file.type as (typeof allowed)[number])) throw new Error('Logo must be PNG, JPEG, WebP, or SVG.');
  if (file.size > 2_000_000) throw new Error('Logo must be 2 MB or smaller.');
  if (file.size === 0) throw new Error('Logo file is empty.');

  if (file.type !== 'image/svg+xml') {
    const mimeType = file.type as Exclude<SafeLogoMime, 'image/svg+xml'>;
    await assertRasterFile(file, mimeType);
    const dataUrl = await readDataUrl(file);
    return { dataUrl, mimeType };
  }

  const source = await file.text();
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG doctypes and entities are not allowed.');
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) throw new Error('Invalid SVG.');
  const root = documentNode.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') throw new Error('Invalid SVG root.');

  for (const node of Array.from(root.querySelectorAll('*'))) {
    if (!SVG_TAGS.has(node.tagName)) {
      node.remove();
      continue;
    }
    for (const attribute of Array.from(node.attributes)) {
      if (isUnsafeAttribute(attribute.name, attribute.value)) node.removeAttribute(attribute.name);
    }
  }
  for (const attribute of Array.from(root.attributes)) {
    if (isUnsafeAttribute(attribute.name, attribute.value)) root.removeAttribute(attribute.name);
  }
  root.setAttribute('xmlns', SVG_NAMESPACE);

  if (!Array.from(root.querySelectorAll('*')).some((node) => RENDERABLE_SVG_TAGS.has(node.tagName))) {
    throw new Error('SVG did not contain renderable geometry after sanitization.');
  }

  const serialized = new XMLSerializer().serializeToString(root);
  if (!serialized.includes('<svg')) throw new Error('SVG did not contain renderable content after sanitization.');
  return { dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`, mimeType: 'image/svg+xml' };
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read image.'));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}
