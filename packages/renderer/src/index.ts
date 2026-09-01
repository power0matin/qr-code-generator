import { encodeMatrix } from '@moduqr/core';
import type { FinderShape, ModuleShape, QRStyle, RenderedQR } from '@moduqr/shared';

export const DEFAULT_STYLE: QRStyle = {
  moduleShape: 'rounded',
  finderOuterShape: 'rounded',
  finderInnerShape: 'circle',
  foreground: '#111827',
  background: '#ffffff',
  gradient: null,
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

function esc(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

function isFinderCell(x: number, y: number, n: number): boolean {
  const inBox = (left: number, top: number): boolean => x >= left && x < left + 7 && y >= top && y < top + 7;
  return inBox(0, 0) || inBox(n - 7, 0) || inBox(0, n - 7);
}

function isLogoCutout(x: number, y: number, n: number, style: QRStyle): boolean {
  if (!style.logo.dataUrl || !style.logo.cutout) return false;
  const span = Math.max(5, Math.floor(n * Math.min(style.logo.size, 0.26)));
  const from = Math.floor((n - span) / 2) - 1;
  const to = from + span + 2;
  return x >= from && x < to && y >= from && y < to;
}

function moduleElement(shape: ModuleShape, x: number, y: number, size: number, gap: number, fill: string): string {
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

function gradientMarkup(style: QRStyle): { readonly defs: string; readonly fill: string } {
  if (!style.gradient) return { defs: '', fill: esc(style.foreground) };
  const stops = style.gradient.stops.map((stop) => `<stop offset="${Math.round(stop.offset * 100)}%" stop-color="${esc(stop.color)}"/>`).join('');
  if (style.gradient.type === 'radial') {
    return { defs: `<radialGradient id="moduqr-gradient" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`, fill: 'url(#moduqr-gradient)' };
  }
  const radians = (style.gradient.angle * Math.PI) / 180;
  const x = Math.cos(radians) * 50;
  const y = Math.sin(radians) * 50;
  return { defs: `<linearGradient id="moduqr-gradient" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stops}</linearGradient>`, fill: 'url(#moduqr-gradient)' };
}

function frameMarkup(style: QRStyle, qrWidth: number, qrHeight: number): { readonly extraHeight: number; readonly markup: string } {
  if (style.frame.style === 'none') return { extraHeight: 0, markup: '' };
  const extraHeight = Math.max(64, style.frame.fontSize + style.frame.padding * 2);
  const y = qrHeight;
  const textY = y + extraHeight / 2 + style.frame.fontSize * 0.34;
  const background = esc(style.background);
  const foreground = esc(style.foreground);
  const radius = style.frame.style === 'rounded' || style.frame.style === 'sticker' ? 24 : style.frame.style === 'badge' ? 999 : 10;
  const rect = `<rect x="0" y="${y - 12}" width="${qrWidth}" height="${extraHeight + 12}" rx="${radius}" fill="${background}"/>`;
  const text = `<text x="${qrWidth / 2}" y="${textY}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${style.frame.fontSize}" font-weight="${style.frame.fontWeight}" fill="${foreground}">${esc(style.frame.text)}</text>`;
  return { extraHeight, markup: `${rect}${text}` };
}

export function renderQR(payload: string, style: QRStyle = DEFAULT_STYLE, targetWidth = 640): RenderedQR {
  const matrix = encodeMatrix(payload, style.errorCorrection);
  const modulePixels = targetWidth / (matrix.size + style.quietZone * 2);
  const qrWidth = targetWidth;
  const qrHeight = targetWidth;
  const quiet = style.quietZone * modulePixels;
  const gradient = gradientMarkup(style);
  const frame = frameMarkup(style, qrWidth, qrHeight);
  const totalHeight = qrHeight + frame.extraHeight;
  const modules: string[] = [];

  for (let y = 0; y < matrix.size; y += 1) {
    const row = matrix.modules[y];
    if (!row) continue;
    for (let x = 0; x < matrix.size; x += 1) {
      if (!row[x] || isFinderCell(x, y, matrix.size) || isLogoCutout(x, y, matrix.size, style)) continue;
      modules.push(moduleElement(style.moduleShape, quiet + x * modulePixels, quiet + y * modulePixels, modulePixels, style.moduleGap, gradient.fill));
    }
  }

  const finderOrigins: readonly [number, number][] = [[0, 0], [matrix.size - 7, 0], [0, matrix.size - 7]];
  const eyes = finderOrigins.map(([x, y]) => {
    const left = quiet + x * modulePixels;
    const top = quiet + y * modulePixels;
    const size = modulePixels * 7;
    return `${finderShape(style.finderOuterShape, left, top, size, modulePixels, gradient.fill)}${finderPupil(style.finderInnerShape, left, top, size, gradient.fill)}`;
  }).join('');

  let logo = '';
  if (style.logo.dataUrl) {
    const logoSize = qrWidth * Math.min(style.logo.size, 0.26);
    const box = logoSize + style.logo.padding * 2;
    const x = (qrWidth - box) / 2;
    const y = (qrHeight - box) / 2;
    const radius = Math.min(box / 2, style.logo.radius);
    logo = `<g><rect x="${x}" y="${y}" width="${box}" height="${box}" rx="${radius}" fill="${esc(style.logo.background)}" stroke="${esc(style.logo.borderColor)}" stroke-width="${style.logo.borderWidth}"/><image href="${esc(style.logo.dataUrl)}" x="${x + style.logo.padding}" y="${y + style.logo.padding}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${qrWidth}" height="${totalHeight}" viewBox="0 0 ${qrWidth} ${totalHeight}" role="img" aria-labelledby="moduqr-title moduqr-desc"><title id="moduqr-title">QR code</title><desc id="moduqr-desc">Generated locally by ModuQR</desc><defs>${gradient.defs}</defs><rect data-role="background" width="${qrWidth}" height="${totalHeight}" fill="${esc(style.background)}"/>${frame.markup}<g>${modules.join('')}${eyes}${logo}</g></svg>`;
  return { svg, matrixSize: matrix.size, viewBoxWidth: qrWidth, viewBoxHeight: totalHeight, modulePixels };
}
