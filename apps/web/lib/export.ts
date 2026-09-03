'use client';

import { decodeCanvas, svgToCanvas } from './qr-image';

export type ExportFormat = 'svg' | 'png' | 'jpeg' | 'webp' | 'pdf';

interface ExportOptions {
  readonly svg: string;
  readonly payload: string;
  readonly format: ExportFormat;
  readonly width: number;
  readonly filename: string;
  readonly transparent: boolean;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type, quality));
}

export async function verifyRenderedSvg(svg: string, payload: string, width = 768): Promise<boolean> {
  const canvas = await svgToCanvas(svg, width, false, '#ffffff');
  return decodeCanvas(canvas) === payload;
}

function removeBackground(svg: string): string {
  return svg.replace(/<rect data-role=\"background\"[^>]*\/>/, '');
}

export async function exportQR(options: ExportOptions): Promise<void> {
  if (!Number.isInteger(options.width) || options.width < 256 || options.width > 8192) {
    throw new Error('Export width must be an integer between 256 and 8192 pixels.');
  }
  const sourceSvg = options.transparent && (options.format === 'svg' || options.format === 'png' || options.format === 'webp') ? removeBackground(options.svg) : options.svg;
  const verified = await verifyRenderedSvg(sourceSvg, options.payload, Math.max(768, Math.min(options.width, 1400)));
  if (!verified) throw new Error('Export blocked: the final rendered QR could not be decoded. Reduce styling or improve contrast.');
  const safeName = options.filename.trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'moduqr';

  if (options.format === 'svg') {
    downloadBlob(new Blob([sourceSvg], { type: 'image/svg+xml;charset=utf-8' }), `${safeName}.svg`);
    return;
  }

  const actualTransparent = options.transparent && (options.format === 'png' || options.format === 'webp');
  const canvas = await svgToCanvas(sourceSvg, options.width, actualTransparent);
  const verificationCanvas = actualTransparent ? await svgToCanvas(sourceSvg, options.width, false, '#ffffff') : canvas;
  if (decodeCanvas(verificationCanvas) !== options.payload) throw new Error('Export blocked: the rasterized output failed decode verification.');

  if (options.format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const png = canvas.toDataURL('image/png');
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
    pdf.addImage(png, 'PNG', 0, 0, canvas.width, canvas.height);
    downloadBlob(pdf.output('blob'), `${safeName}.pdf`);
    return;
  }

  const type = options.format === 'png' ? 'image/png' : options.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const blob = await canvasBlob(canvas, type, options.format === 'png' ? undefined : 0.94);
  const checkUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const candidate = new Image();
      candidate.onload = () => resolve(candidate);
      candidate.onerror = () => reject(new Error('Could not verify compressed export.'));
      candidate.src = checkUrl;
    });
    const verify = document.createElement('canvas');
    verify.width = image.naturalWidth;
    verify.height = image.naturalHeight;
    const context = verify.getContext('2d');
    if (!context) throw new Error('Canvas verification is unavailable.');
    if (actualTransparent) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, verify.width, verify.height); }
    context.drawImage(image, 0, 0);
    if (decodeCanvas(verify) !== options.payload) throw new Error('Export blocked: the compressed file failed QR decode verification.');
  } finally {
    URL.revokeObjectURL(checkUrl);
  }
  downloadBlob(blob, `${safeName}.${options.format === 'jpeg' ? 'jpg' : options.format}`);
}
