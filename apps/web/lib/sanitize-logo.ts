'use client';

const SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask']);
const SVG_ATTRS = new Set(['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'clip-path', 'mask']);

export async function sanitizeLogoFile(file: File): Promise<{ readonly dataUrl: string; readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' }> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
  if (!allowed.includes(file.type as (typeof allowed)[number])) throw new Error('Logo must be PNG, JPEG, WebP, or SVG.');
  if (file.size > 2_000_000) throw new Error('Logo must be 2 MB or smaller.');

  if (file.type !== 'image/svg+xml') {
    const dataUrl = await readDataUrl(file);
    return { dataUrl, mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp' };
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
      const name = attribute.name;
      const value = attribute.value;
      if (!SVG_ATTRS.has(name) || name.toLowerCase().startsWith('on') || /(?:javascript:|data:text\/html|https?:|url\s*\()/i.test(value)) node.removeAttribute(name);
    }
  }
  for (const attribute of Array.from(root.attributes)) {
    const name = attribute.name;
    const value = attribute.value;
    if (!SVG_ATTRS.has(name) || name.toLowerCase().startsWith('on') || /(?:javascript:|data:text\/html|https?:|url\s*\()/i.test(value)) root.removeAttribute(name);
  }
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const serialized = new XMLSerializer().serializeToString(root);
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
