'use client';

import { inspectRasterDimensions, rasterDimensionsWithinLimits, type RasterMimeType } from '@moduqr/core';

const SVG_TAG_NAMES = new Map<string, string>([
  ['svg', 'svg'],
  ['g', 'g'],
  ['path', 'path'],
  ['rect', 'rect'],
  ['circle', 'circle'],
  ['ellipse', 'ellipse'],
  ['line', 'line'],
  ['polyline', 'polyline'],
  ['polygon', 'polygon'],
  ['defs', 'defs'],
  ['lineargradient', 'linearGradient'],
  ['radialgradient', 'radialGradient'],
  ['stop', 'stop'],
  ['clippath', 'clipPath'],
  ['mask', 'mask'],
]);
const SVG_ATTRIBUTE_NAMES = new Map<string, string>([
  'xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform',
  'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'clip-path', 'mask',
].map((name): [string, string] => [name.toLowerCase(), name]));
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const RENDERABLE_SVG_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

type SafeLogoMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
type SvgAttribute = Readonly<{ name: string; value: string }>;
type SvgTag = Readonly<{ name: string; closing: boolean; selfClosing: boolean; attributes: readonly SvgAttribute[] }>;
type SvgStackEntry = Readonly<{ name: string; canonicalName: string | null; emitted: boolean; skippedUnknown: boolean }>;

const MAX_LOGO_DIMENSION = 4096;
const MAX_LOGO_PIXELS = 16_000_000;

function assertSafeRasterDimensions(bytes: Uint8Array, mimeType: Exclude<SafeLogoMime, 'image/svg+xml'>): void {
  const dimensions = inspectRasterDimensions(bytes, mimeType as RasterMimeType);
  if (!dimensions) throw new Error('The logo file contents do not match its declared image type.');
  if (!rasterDimensionsWithinLimits(dimensions, MAX_LOGO_DIMENSION, MAX_LOGO_PIXELS)) {
    throw new Error('Logo dimensions are too large. Use an image up to 4096×4096 and 16 megapixels.');
  }
}

function isXmlNameCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57)
    || (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || character === '_'
    || character === ':'
    || character === '-'
    || character === '.';
}

function isWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\r' || character === '\n';
}

function skipWhitespace(value: string, start: number): number {
  let index = start;
  while (index < value.length && isWhitespace(value[index] ?? '')) index += 1;
  return index;
}

function readXmlName(value: string, start: number): Readonly<{ name: string; next: number }> {
  let index = start;
  while (index < value.length && isXmlNameCharacter(value[index] ?? '')) index += 1;
  if (index === start) throw new Error('Invalid SVG tag or attribute name.');
  return { name: value.slice(start, index), next: index };
}

function findTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index] ?? '';
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '>') return index;
  }
  return -1;
}

function parseSvgTag(token: string): SvgTag {
  let index = skipWhitespace(token, 0);
  let closing = false;
  if (token[index] === '/') {
    closing = true;
    index = skipWhitespace(token, index + 1);
  }

  const nameResult = readXmlName(token, index);
  const name = nameResult.name;
  index = nameResult.next;

  if (closing) {
    index = skipWhitespace(token, index);
    if (index !== token.length) throw new Error('Invalid SVG closing tag.');
    return { name, closing: true, selfClosing: false, attributes: [] };
  }

  const attributes: SvgAttribute[] = [];
  const seen = new Set<string>();
  let selfClosing = false;

  while (index < token.length) {
    index = skipWhitespace(token, index);
    if (index >= token.length) break;
    if (token[index] === '/') {
      selfClosing = true;
      index = skipWhitespace(token, index + 1);
      if (index !== token.length) throw new Error('Invalid self-closing SVG tag.');
      break;
    }

    const attributeResult = readXmlName(token, index);
    const attributeName = attributeResult.name;
    index = skipWhitespace(token, attributeResult.next);
    if (token[index] !== '=') throw new Error('SVG attributes must use quoted values.');
    index = skipWhitespace(token, index + 1);
    const quote = token[index];
    if (quote !== '"' && quote !== "'") throw new Error('SVG attributes must use quoted values.');
    index += 1;
    const valueStart = index;
    while (index < token.length && token[index] !== quote) index += 1;
    if (index >= token.length) throw new Error('Unterminated SVG attribute value.');
    const attributeValue = token.slice(valueStart, index);
    index += 1;

    const duplicateKey = attributeName.toLowerCase();
    if (seen.has(duplicateKey)) throw new Error('Duplicate SVG attributes are not allowed.');
    seen.add(duplicateKey);
    attributes.push({ name: attributeName, value: attributeValue });
  }

  return { name, closing: false, selfClosing, attributes };
}

function isLocalFragmentIdentifier(value: string): boolean {
  if (value.length < 2 || value[0] !== '#') return false;
  const first = value[1] ?? '';
  if (!((first >= 'A' && first <= 'Z') || (first >= 'a' && first <= 'z') || first === '_')) return false;
  for (let index = 2; index < value.length; index += 1) {
    const character = value[index] ?? '';
    const valid = (character >= 'A' && character <= 'Z')
      || (character >= 'a' && character <= 'z')
      || (character >= '0' && character <= '9')
      || character === '_'
      || character === ':'
      || character === '.'
      || character === '-';
    if (!valid) return false;
  }
  return true;
}

function hasOnlyLocalPaintReferences(value: string): boolean {
  const lower = value.toLowerCase();
  let cursor = 0;
  while (cursor < value.length) {
    const marker = lower.indexOf('url(', cursor);
    if (marker < 0) return true;
    let index = skipWhitespace(value, marker + 4);
    const quote = value[index] === '"' || value[index] === "'" ? value[index] : null;
    if (quote) index += 1;
    const referenceStart = index;

    if (quote) {
      const closingQuote = value.indexOf(quote, index);
      if (closingQuote < 0) return false;
      const reference = value.slice(referenceStart, closingQuote).trim();
      index = skipWhitespace(value, closingQuote + 1);
      if (value[index] !== ')') return false;
      cursor = index + 1;
      if (!isLocalFragmentIdentifier(reference)) return false;
      continue;
    }

    const closingParenthesis = value.indexOf(')', index);
    if (closingParenthesis < 0) return false;
    const reference = value.slice(referenceStart, closingParenthesis).trim();
    if (!isLocalFragmentIdentifier(reference)) return false;
    cursor = closingParenthesis + 1;
  }
  return true;
}

function isUnsafeAttributeValue(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes('javascript:')
    || lower.includes('data:text/html')
    || lower.includes('file:')
    || lower.includes('ftp:')
    || lower.includes('http:')
    || lower.includes('https:')
    || lower.includes('@import')
    || lower.includes('expression(')) return true;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 0 || (code < 32 && !isWhitespace(character))) return true;
  }
  return !hasOnlyLocalPaintReferences(value);
}

function escapeXmlAttribute(value: string): string {
  let escaped = '';
  for (const character of value) {
    switch (character) {
      case '&': escaped += '&amp;'; break;
      case '<': escaped += '&lt;'; break;
      case '>': escaped += '&gt;'; break;
      case '"': escaped += '&quot;'; break;
      case "'": escaped += '&apos;'; break;
      default: escaped += character;
    }
  }
  return escaped;
}

function sanitizedAttributeMarkup(attributes: readonly SvgAttribute[], root: boolean): string {
  const safe: string[] = [];
  if (root) safe.push(`xmlns="${SVG_NAMESPACE}"`);
  for (const attribute of attributes) {
    const lowerName = attribute.name.toLowerCase();
    const canonicalName = SVG_ATTRIBUTE_NAMES.get(lowerName);
    if (!canonicalName || lowerName.startsWith('on') || canonicalName === 'xmlns') continue;
    if (isUnsafeAttributeValue(attribute.value)) continue;
    safe.push(`${canonicalName}="${escapeXmlAttribute(attribute.value)}"`);
  }
  return safe.length > 0 ? ` ${safe.join(' ')}` : '';
}

function sanitizeSvgSource(source: string): string {
  const upper = source.toUpperCase();
  if (upper.includes('<!DOCTYPE') || upper.includes('<!ENTITY') || upper.includes('<![CDATA[')) {
    throw new Error('SVG doctypes, entities, and CDATA are not allowed.');
  }

  const output: string[] = [];
  const stack: SvgStackEntry[] = [];
  let cursor = 0;
  let skippedDepth = 0;
  let rootSeen = false;
  let rootClosed = false;
  let hasRenderableGeometry = false;

  while (cursor < source.length) {
    const tagStart = source.indexOf('<', cursor);
    if (tagStart < 0) {
      const tail = source.slice(cursor);
      if (skippedDepth === 0 && tail.trim() !== '') throw new Error('SVG text nodes are not supported.');
      cursor = source.length;
      break;
    }

    const text = source.slice(cursor, tagStart);
    if (skippedDepth === 0 && text.trim() !== '') throw new Error('SVG text nodes are not supported.');

    if (source.startsWith('<!--', tagStart)) {
      const commentEnd = source.indexOf('-->', tagStart + 4);
      if (commentEnd < 0) throw new Error('Invalid SVG comment.');
      cursor = commentEnd + 3;
      continue;
    }

    if (source.startsWith('<?', tagStart)) {
      const instructionEnd = source.indexOf('?>', tagStart + 2);
      if (instructionEnd < 0) throw new Error('Invalid SVG processing instruction.');
      const instruction = source.slice(tagStart + 2, instructionEnd).trim().toLowerCase();
      if (rootSeen || !(instruction === 'xml' || instruction.startsWith('xml '))) throw new Error('SVG processing instructions are not allowed.');
      cursor = instructionEnd + 2;
      continue;
    }

    if (source.startsWith('<!', tagStart)) throw new Error('Unsupported SVG declaration.');

    const tagEnd = findTagEnd(source, tagStart + 1);
    if (tagEnd < 0) throw new Error('Invalid SVG tag.');
    const parsed = parseSvgTag(source.slice(tagStart + 1, tagEnd));
    const lowerName = parsed.name.toLowerCase();

    if (parsed.closing) {
      const entry = stack.pop();
      if (!entry || entry.name !== lowerName) throw new Error('Mismatched SVG closing tag.');
      if (entry.emitted && entry.canonicalName) output.push(`</${entry.canonicalName}>`);
      if (entry.skippedUnknown) skippedDepth -= 1;
      if (entry.canonicalName === 'svg' && stack.length === 0) rootClosed = true;
      cursor = tagEnd + 1;
      continue;
    }

    if (rootClosed) throw new Error('SVG must contain exactly one root element.');
    const canonicalName = SVG_TAG_NAMES.get(lowerName) ?? null;
    if (!rootSeen) {
      if (canonicalName !== 'svg') throw new Error('Invalid SVG root.');
      rootSeen = true;
    } else if (stack.length === 0) {
      throw new Error('SVG must contain exactly one root element.');
    } else if (canonicalName === 'svg') {
      throw new Error('Nested SVG roots are not allowed.');
    }

    const parentSkipped = skippedDepth > 0;
    const emitted = canonicalName !== null && !parentSkipped;
    const skippedUnknown = canonicalName === null && !parsed.selfClosing;

    if (emitted && canonicalName) {
      const root = canonicalName === 'svg';
      const attributes = sanitizedAttributeMarkup(parsed.attributes, root);
      output.push(`<${canonicalName}${attributes}${parsed.selfClosing ? '/>' : '>'}`);
      if (RENDERABLE_SVG_TAGS.has(canonicalName)) hasRenderableGeometry = true;
    }

    if (!parsed.selfClosing) {
      if (skippedUnknown) skippedDepth += 1;
      stack.push({ name: lowerName, canonicalName, emitted, skippedUnknown });
    } else if (canonicalName === 'svg') {
      rootClosed = true;
    }

    cursor = tagEnd + 1;
  }

  if (!rootSeen || !rootClosed || stack.length !== 0 || skippedDepth !== 0) throw new Error('Invalid or unbalanced SVG.');
  if (!hasRenderableGeometry) throw new Error('SVG did not contain renderable geometry after sanitization.');
  const serialized = output.join('');
  if (!serialized.startsWith('<svg ') && !serialized.startsWith('<svg>')) throw new Error('SVG did not contain renderable content after sanitization.');
  return serialized;
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

  const source = await readText(file);
  const serialized = sanitizeSvgSource(source);
  return { dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`, mimeType: 'image/svg+xml' };
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read SVG.'));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read SVG.'));
    reader.readAsText(file);
  });
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Failed to read image.'));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}
