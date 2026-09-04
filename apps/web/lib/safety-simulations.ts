'use client';

import type { SafetySimulationResult } from '@moduqr/shared';
import { decodeCanvas, svgToCanvas } from './qr-image';

const SIZE = 720;

function makeCanvas(width = SIZE, height = SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function decode(canvas: HTMLCanvasElement, payload: string): boolean {
  return decodeCanvas(canvas) === payload;
}

export async function runSafetySimulations(svg: string, payload: string): Promise<readonly SafetySimulationResult[]> {
  const baseline = await svgToCanvas(svg, SIZE, false, '#ffffff');
  const results: SafetySimulationResult[] = [
    { kind: 'baseline', label: 'Baseline', decoded: decode(baseline, payload) },
  ];

  const blur = makeCanvas();
  const blurContext = blur.getContext('2d');
  if (blurContext) {
    blurContext.fillStyle = '#ffffff';
    blurContext.fillRect(0, 0, SIZE, SIZE);
    blurContext.filter = 'blur(1.1px)';
    blurContext.drawImage(baseline, 0, 0);
    blurContext.filter = 'none';
  }
  results.push({ kind: 'blur', label: 'Blur 1.1px', decoded: Boolean(blurContext) && decode(blur, payload) });

  const small = makeCanvas(180, 180);
  const smallContext = small.getContext('2d');
  if (smallContext) smallContext.drawImage(baseline, 0, 0, 180, 180);
  const scaled = makeCanvas();
  const scaledContext = scaled.getContext('2d');
  if (scaledContext && smallContext) {
    scaledContext.fillStyle = '#ffffff';
    scaledContext.fillRect(0, 0, SIZE, SIZE);
    scaledContext.imageSmoothingEnabled = true;
    scaledContext.drawImage(small, 0, 0, SIZE, SIZE);
  }
  results.push({ kind: 'scale', label: '25% scale round-trip', decoded: Boolean(scaledContext && smallContext) && decode(scaled, payload) });

  const rotated = makeCanvas();
  const rotatedContext = rotated.getContext('2d');
  if (rotatedContext) {
    rotatedContext.fillStyle = '#ffffff';
    rotatedContext.fillRect(0, 0, SIZE, SIZE);
    rotatedContext.translate(SIZE / 2, SIZE / 2);
    rotatedContext.rotate(3 * Math.PI / 180);
    rotatedContext.drawImage(baseline, -SIZE / 2, -SIZE / 2);
    rotatedContext.setTransform(1, 0, 0, 1, 0, 0);
  }
  results.push({ kind: 'rotation', label: 'Rotation 3°', decoded: Boolean(rotatedContext) && decode(rotated, payload) });

  const lowContrast = makeCanvas();
  const contrastContext = lowContrast.getContext('2d');
  if (contrastContext) {
    contrastContext.fillStyle = '#ffffff';
    contrastContext.fillRect(0, 0, SIZE, SIZE);
    contrastContext.globalAlpha = 0.72;
    contrastContext.drawImage(baseline, 0, 0);
    contrastContext.globalAlpha = 1;
  }
  results.push({ kind: 'contrast', label: 'Reduced contrast', decoded: Boolean(contrastContext) && decode(lowContrast, payload) });

  return results;
}
