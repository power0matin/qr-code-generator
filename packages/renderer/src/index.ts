import { decodeBase64DataUrl, encodeMatrix, inspectRasterDimensions, rasterDimensionsWithinLimits } from '@moduqr/core';
import type {
  ErrorCorrectionLevel,
  FinderOverride,
  FinderPosition,
  FinderShape,
  FrameStyle,
  GradientDefinition,
  ModuleShape,
  QRStyle,
  RenderedQR,
} from '@moduqr/shared';


const MODULE_SHAPES = new Set<ModuleShape>(['square', 'rounded', 'extra-rounded', 'dots', 'circle', 'diamond', 'soft-square', 'pixel', 'connected', 'fluid']);
const FINDER_SHAPES = new Set<FinderShape>(['square', 'rounded', 'circle']);
const FRAME_STYLES = new Set<FrameStyle>(['none', 'minimal', 'rounded', 'badge', 'label', 'sticker']);
const ERROR_CORRECTION_LEVELS = new Set<ErrorCorrectionLevel>(['L', 'M', 'Q', 'H']);

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function safeModuleShape(value: unknown): ModuleShape {
  return typeof value === 'string' && MODULE_SHAPES.has(value as ModuleShape) ? value as ModuleShape : 'rounded';
}

function safeFinderShape(value: unknown, fallback: FinderShape): FinderShape {
  return typeof value === 'string' && FINDER_SHAPES.has(value as FinderShape) ? value as FinderShape : fallback;
}

function safeFrameStyle(value: unknown): FrameStyle {
  return typeof value === 'string' && FRAME_STYLES.has(value as FrameStyle) ? value as FrameStyle : 'none';
}

function safeErrorCorrection(value: unknown): ErrorCorrectionLevel {
  return typeof value === 'string' && ERROR_CORRECTION_LEVELS.has(value as ErrorCorrectionLevel) ? value as ErrorCorrectionLevel : 'M';
}

function safeGradient(value: unknown, fallbackColor: string): GradientDefinition | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<GradientDefinition>;
  if ((candidate.type !== 'linear' && candidate.type !== 'radial') || !Array.isArray(candidate.stops)) return null;
  const stops = candidate.stops.slice(0, 8).flatMap((stop) => {
    if (typeof stop !== 'object' || stop === null) return [];
    const candidateStop = stop as Partial<GradientDefinition['stops'][number]>;
    return [{
      offset: finiteNumber(candidateStop.offset, 0, 0, 1),
      color: safeColor(candidateStop.color, fallbackColor),
    }];
  });
  if (stops.length < 2) return null;
  return {
    type: candidate.type,
    angle: finiteNumber(candidate.angle, 0, 0, 360),
    stops,
  };
}

const EMPTY_FINDER_OVERRIDE: FinderOverride = {
  outerShape: null,
  innerShape: null,
  outerColor: null,
  innerColor: null,
};

export const DEFAULT_STYLE: QRStyle = {
  moduleShape: 'rounded',
  finderOuterShape: 'rounded',
  finderInnerShape: 'circle',
  finderOverrides: {
    topLeft: EMPTY_FINDER_OVERRIDE,
    topRight: EMPTY_FINDER_OVERRIDE,
    bottomLeft: EMPTY_FINDER_OVERRIDE,
  },
  foreground: '#111827',
  background: '#ffffff',
  gradient: null,
  backgroundGradient: null,
  quietZone: 4,
  moduleGap: 0.08,
  errorCorrection: 'M',
  logo: {
    dataUrl: null,
    mimeType: null,
    size: 0.2,
    padding: 4,
    background: '#ffffff',
    radius: 20,
    borderWidth: 0,
    borderColor: '#ffffff',
    cutout: true,
  },
  frame: { style: 'none', text: 'Scan me', fontSize: 18, fontWeight: 600, padding: 24 },
};

interface Neighbors {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

interface ResolvedFinderStyle {
  readonly outerShape: FinderShape;
  readonly innerShape: FinderShape;
  readonly outerFill: string;
  readonly innerFill: string;
}

function esc(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

const SAFE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && SAFE_HEX.test(value) ? value : fallback;
}

const MAX_RUNTIME_LOGO_DIMENSION = 4096;
const MAX_RUNTIME_LOGO_PIXELS = 16_000_000;

function safeRasterDataUrl(value: string, mimeType: 'image/png' | 'image/jpeg' | 'image/webp'): string | null {
  const patterns: Record<'image/png' | 'image/jpeg' | 'image/webp', RegExp> = {
    'image/png': /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/i,
    'image/jpeg': /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/i,
    'image/webp': /^data:image\/webp;base64,UklGR[A-Za-z0-9+/]*={0,2}$/i,
  };
  if (!patterns[mimeType].test(value)) return null;
  const bytes = decodeBase64DataUrl(value);
  if (!bytes) return null;
  const dimensions = inspectRasterDimensions(bytes, mimeType);
  return rasterDimensionsWithinLimits(dimensions, MAX_RUNTIME_LOGO_DIMENSION, MAX_RUNTIME_LOGO_PIXELS) ? value : null;
}

const SAFE_LOGO_SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask']);
const RENDERABLE_LOGO_SVG_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

function safeLogoHref(value: unknown, mimeType: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 3_000_000) return null;
  if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp') return safeRasterDataUrl(value, mimeType);
  if (mimeType !== 'image/svg+xml') return null;
  const svg = value.match(/^data:image\/svg\+xml(?:;charset=utf-8)?,(.*)$/is);
  if (!svg?.[1]) return null;
  try {
    const source = decodeURIComponent(svg[1]);
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)) return null;
    if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source)) return null;
    if (/\son[a-z-]+\s*=|\b(?:href|src|xlink:href|style)\s*=/i.test(source)) return null;
    if (/javascript:|data:text\/html|file:|ftp:|@import|expression\s*\(/i.test(source)) return null;
    let hasRenderableGeometry = false;
    for (const match of source.matchAll(/<\/?\s*([A-Za-z][\w:-]*)\b/g)) {
      const tag = match[1]?.toLowerCase() ?? '';
      if (!SAFE_LOGO_SVG_TAGS.has(tag)) return null;
      if (!match[0]?.startsWith('</') && RENDERABLE_LOGO_SVG_TAGS.has(tag)) hasRenderableGeometry = true;
    }
    if (!hasRenderableGeometry) return null;
    for (const match of source.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
      const reference = match[2]?.trim() ?? '';
      if (!/^#[A-Za-z_][\w:.-]*$/.test(reference)) return null;
    }
    return value;
  } catch {
    return null;
  }
}

function isFinderCell(x: number, y: number, n: number): boolean {
  const inBox = (left: number, top: number): boolean => x >= left && x < left + 7 && y >= top && y < top + 7;
  return inBox(0, 0) || inBox(n - 7, 0) || inBox(0, n - 7);
}

function isLogoCutout(x: number, y: number, n: number, span: number, enabled: boolean): boolean {
  if (!enabled || span <= 0) return false;
  const safeSpan = Math.min(n, Math.max(5, span));
  const from = Math.floor((n - safeSpan) / 2);
  const to = from + safeSpan;
  return x >= from && x < to && y >= from && y < to;
}

function roundedRectPath(
  left: number,
  top: number,
  right: number,
  bottom: number,
  radii: Readonly<{ tl: number; tr: number; br: number; bl: number }>,
): string {
  const width = Math.max(0.01, right - left);
  const height = Math.max(0.01, bottom - top);
  const maxRadius = Math.min(width, height) / 2;
  const tl = Math.min(radii.tl, maxRadius);
  const tr = Math.min(radii.tr, maxRadius);
  const br = Math.min(radii.br, maxRadius);
  const bl = Math.min(radii.bl, maxRadius);
  return [
    `M ${left + tl} ${top}`,
    `H ${right - tr}`,
    tr > 0 ? `Q ${right} ${top} ${right} ${top + tr}` : `L ${right} ${top}`,
    `V ${bottom - br}`,
    br > 0 ? `Q ${right} ${bottom} ${right - br} ${bottom}` : `L ${right} ${bottom}`,
    `H ${left + bl}`,
    bl > 0 ? `Q ${left} ${bottom} ${left} ${bottom - bl}` : `L ${left} ${bottom}`,
    `V ${top + tl}`,
    tl > 0 ? `Q ${left} ${top} ${left + tl} ${top}` : `L ${left} ${top}`,
    'Z',
  ].join(' ');
}

function connectedModuleElement(
  shape: 'connected' | 'fluid',
  x: number,
  y: number,
  size: number,
  gap: number,
  fill: string,
  neighbors: Neighbors,
): string {
  const inset = (gap * size) / 2;
  const left = neighbors.left ? x : x + inset;
  const right = neighbors.right ? x + size : x + size - inset;
  const top = neighbors.top ? y : y + inset;
  const bottom = neighbors.bottom ? y + size : y + size - inset;
  const radius = size * (shape === 'fluid' ? 0.46 : 0.28);
  const path = roundedRectPath(left, top, right, bottom, {
    tl: !neighbors.top && !neighbors.left ? radius : 0,
    tr: !neighbors.top && !neighbors.right ? radius : 0,
    br: !neighbors.bottom && !neighbors.right ? radius : 0,
    bl: !neighbors.bottom && !neighbors.left ? radius : 0,
  });
  return `<path d="${path}" fill="${fill}"/>`;
}

function moduleElement(
  shape: ModuleShape,
  x: number,
  y: number,
  size: number,
  gap: number,
  fill: string,
  neighbors: Neighbors,
): string {
  if (shape === 'connected' || shape === 'fluid') {
    return connectedModuleElement(shape, x, y, size, gap, fill, neighbors);
  }

  const inset = (gap * size) / 2;
  const s = Math.max(0.01, size - inset * 2);
  const px = x + inset;
  const py = y + inset;
  switch (shape) {
    case 'square':
    case 'pixel':
      return `<rect x="${px}" y="${py}" width="${s}" height="${s}" fill="${fill}"/>`;
    case 'rounded':
      return `<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="${s * 0.24}" fill="${fill}"/>`;
    case 'extra-rounded':
      return `<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="${s * 0.42}" fill="${fill}"/>`;
    case 'soft-square':
      return `<rect x="${px}" y="${py}" width="${s}" height="${s}" rx="${s * 0.14}" fill="${fill}"/>`;
    case 'dots':
    case 'circle':
      return `<circle cx="${px + s / 2}" cy="${py + s / 2}" r="${s / 2}" fill="${fill}"/>`;
    case 'diamond': {
      const cx = px + s / 2;
      const cy = py + s / 2;
      return `<path d="M ${cx} ${py} L ${px + s} ${cy} L ${cx} ${py + s} L ${px} ${cy} Z" fill="${fill}"/>`;
    }
  }
  throw new Error(`Unsupported module shape: ${String(shape)}`);
}

function finderShape(shape: FinderShape, x: number, y: number, size: number, strokeWidth: number, fill: string): string {
  const radius = shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : 0;
  if (shape === 'circle') {
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${(size - strokeWidth) / 2}" fill="none" stroke="${fill}" stroke-width="${strokeWidth}"/>`;
  }
  return `<rect x="${x + strokeWidth / 2}" y="${y + strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" rx="${radius}" fill="none" stroke="${fill}" stroke-width="${strokeWidth}"/>`;
}

function finderPupil(shape: FinderShape, x: number, y: number, size: number, fill: string): string {
  const inset = size * 2 / 7;
  const pupil = size * 3 / 7;
  if (shape === 'circle') return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${pupil / 2}" fill="${fill}"/>`;
  return `<rect x="${x + inset}" y="${y + inset}" width="${pupil}" height="${pupil}" rx="${shape === 'rounded' ? pupil * 0.25 : 0}" fill="${fill}"/>`;
}

function gradientDefinitionMarkup(id: string, gradient: GradientDefinition, fallback: string): string {
  const sortedStops = [...gradient.stops].sort((a, b) => a.offset - b.offset);
  const stops = sortedStops.map((stop) => `<stop offset="${Math.round(stop.offset * 100)}%" stop-color="${esc(safeColor(stop.color, fallback))}"/>`).join('');
  if (gradient.type === 'radial') {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`;
  }
  const angle = Number.isFinite(gradient.angle) ? Math.max(0, Math.min(360, gradient.angle)) : 0;
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians) * 50;
  const y = Math.sin(radians) * 50;
  return `<linearGradient id="${id}" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stops}</linearGradient>`;
}

function modulePaint(style: QRStyle): { readonly defs: string; readonly fill: string } {
  const foreground = safeColor(style.foreground, '#111827');
  const gradient = safeGradient(style.gradient, foreground);
  if (!gradient) return { defs: '', fill: esc(foreground) };
  return { defs: gradientDefinitionMarkup('moduqr-module-gradient', gradient, foreground), fill: 'url(#moduqr-module-gradient)' };
}

function backgroundPaint(style: QRStyle): { readonly defs: string; readonly fill: string } {
  const background = safeColor(style.background, '#ffffff');
  const gradient = safeGradient(style.backgroundGradient, background);
  if (!gradient) return { defs: '', fill: esc(background) };
  return { defs: gradientDefinitionMarkup('moduqr-background-gradient', gradient, background), fill: 'url(#moduqr-background-gradient)' };
}

function resolveFinderStyle(style: QRStyle, position: FinderPosition): ResolvedFinderStyle {
  const overrides = style.finderOverrides as Partial<Record<FinderPosition, FinderOverride>> | undefined;
  const override = overrides?.[position] ?? EMPTY_FINDER_OVERRIDE;
  const fallback = safeColor(style.foreground, '#111827');
  return {
    outerShape: safeFinderShape(override.outerShape ?? style.finderOuterShape, 'rounded'),
    innerShape: safeFinderShape(override.innerShape ?? style.finderInnerShape, 'circle'),
    outerFill: esc(override.outerColor ? safeColor(override.outerColor, fallback) : fallback),
    innerFill: esc(override.innerColor ? safeColor(override.innerColor, fallback) : fallback),
  };
}

function frameMarkup(style: QRStyle, qrWidth: number, qrHeight: number): { readonly extraHeight: number; readonly markup: string } {
  const frameStyle = safeFrameStyle(style.frame.style);
  if (frameStyle === 'none') return { extraHeight: 0, markup: '' };
  const gap = 12;
  const fontSize = finiteNumber(style.frame.fontSize, 18, 10, 40);
  const padding = finiteNumber(style.frame.padding, 24, 8, 64);
  const fontWeight = [400, 500, 600, 700].includes(style.frame.fontWeight) ? style.frame.fontWeight : 600;
  const frameHeight = Math.max(64, fontSize + padding * 2);
  const y = qrHeight + gap;
  const textY = y + frameHeight / 2 + fontSize * 0.34;
  const background = esc(safeColor(style.background, '#ffffff'));
  const foreground = esc(safeColor(style.foreground, '#111827'));
  const radius = frameStyle === 'rounded' || frameStyle === 'sticker' ? 24 : frameStyle === 'badge' ? 999 : 10;
  const rect = `<rect data-role="frame" x="0" y="${y}" width="${qrWidth}" height="${frameHeight}" rx="${radius}" fill="${background}"/>`;
  const textValue = typeof style.frame.text === 'string' ? style.frame.text.slice(0, 80) : '';
  const text = `<text x="${qrWidth / 2}" y="${textY}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${foreground}">${esc(textValue)}</text>`;
  return { extraHeight: gap + frameHeight, markup: `${rect}${text}` };
}

export function renderQR(payload: string, style: QRStyle = DEFAULT_STYLE, targetWidth = 640): RenderedQR {
  const matrix = encodeMatrix(payload, safeErrorCorrection(style.errorCorrection));
  const qrWidth = Number.isFinite(targetWidth) ? Math.max(64, Math.min(16_384, targetWidth)) : 640;
  const qrHeight = qrWidth;
  const quietZone = Math.round(finiteNumber(style.quietZone, 4, 4, 16));
  const modulePixels = qrWidth / (matrix.size + quietZone * 2);
  const quiet = quietZone * modulePixels;
  const logoHref = safeLogoHref(style.logo.dataUrl, style.logo.mimeType);
  const logoActive = logoHref !== null;
  const logoCutout = style.logo.cutout === true;
  const logoSize = qrWidth * finiteNumber(style.logo.size, 0.2, 0.1, 0.26);
  const logoPadding = finiteNumber(style.logo.padding, 4, 0, 20);
  const logoBorderWidth = finiteNumber(style.logo.borderWidth, 0, 0, 8);
  const moduleGap = finiteNumber(style.moduleGap, 0.08, 0, 0.35);
  const moduleShape = safeModuleShape(style.moduleShape);
  const logoBox = logoSize + logoPadding * 2;
  const logoCutoutSpan = logoActive && logoCutout
    ? Math.min(matrix.size, Math.ceil((logoBox + logoBorderWidth) / modulePixels) + 2)
    : 0;
  const modulesPaint = modulePaint(style);
  const bgPaint = backgroundPaint(style);
  const frame = frameMarkup(style, qrWidth, qrHeight);
  const totalHeight = qrHeight + frame.extraHeight;
  const modules: string[] = [];

  const isRenderableDark = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= matrix.size || y >= matrix.size) return false;
    const row = matrix.modules[y];
    return Boolean(row?.[x]) && !isFinderCell(x, y, matrix.size) && !isLogoCutout(x, y, matrix.size, logoCutoutSpan, logoActive && logoCutout);
  };

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.modules[y];
    if (!row) continue;
    for (let x = 0; x < matrix.size; x += 1) {
      if (!row[x] || isFinderCell(x, y, matrix.size) || isLogoCutout(x, y, matrix.size, logoCutoutSpan, logoActive && logoCutout)) continue;
      const neighbors: Neighbors = {
        top: isRenderableDark(x, y - 1),
        right: isRenderableDark(x + 1, y),
        bottom: isRenderableDark(x, y + 1),
        left: isRenderableDark(x - 1, y),
      };
      modules.push(moduleElement(moduleShape, quiet + x * modulePixels, quiet + y * modulePixels, modulePixels, moduleGap, modulesPaint.fill, neighbors));
    }
  }

  const finderOrigins: readonly { readonly position: FinderPosition; readonly x: number; readonly y: number }[] = [
    { position: 'topLeft', x: 0, y: 0 },
    { position: 'topRight', x: matrix.size - 7, y: 0 },
    { position: 'bottomLeft', x: 0, y: matrix.size - 7 },
  ];
  const eyes = finderOrigins.map(({ position, x, y }) => {
    const left = quiet + x * modulePixels;
    const top = quiet + y * modulePixels;
    const size = modulePixels * 7;
    // Finder patterns stay solid by default even when modules use a gradient.
    // This preserves their locator geometry and improves decoder reliability.
    const finder = resolveFinderStyle(style, position);
    return `${finderShape(finder.outerShape, left, top, size, modulePixels, finder.outerFill)}${finderPupil(finder.innerShape, left, top, size, finder.innerFill)}`;
  }).join('');

  let logo = '';
  if (logoHref) {
    const x = (qrWidth - logoBox) / 2;
    const y = (qrHeight - logoBox) / 2;
    const radius = Math.min(logoBox / 2, finiteNumber(style.logo.radius, 20, 0, 100));
    const logoBackground = esc(safeColor(style.logo.background, '#ffffff'));
    const logoBorder = esc(safeColor(style.logo.borderColor, '#ffffff'));
    logo = `<g><rect x="${x}" y="${y}" width="${logoBox}" height="${logoBox}" rx="${radius}" fill="${logoBackground}" stroke="${logoBorder}" stroke-width="${logoBorderWidth}"/><image href="${esc(logoHref)}" x="${x + logoPadding}" y="${y + logoPadding}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></g>`;
  }

  const defs = `${modulesPaint.defs}${bgPaint.defs}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${qrWidth}" height="${totalHeight}" viewBox="0 0 ${qrWidth} ${totalHeight}" role="img" aria-labelledby="moduqr-title moduqr-desc"><title id="moduqr-title">QR code</title><desc id="moduqr-desc">Generated locally by ModuQR</desc><defs>${defs}</defs><rect data-role="background" width="${qrWidth}" height="${totalHeight}" fill="${bgPaint.fill}"/>${frame.markup}<g data-role="modules">${modules.join('')}</g><g data-role="finders">${eyes}</g>${logo}</svg>`;
  return { svg, matrixSize: matrix.size, viewBoxWidth: qrWidth, viewBoxHeight: totalHeight, modulePixels };
}
