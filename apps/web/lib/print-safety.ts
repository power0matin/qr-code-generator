export interface PrintPlanInput {
  readonly matrixSize: number;
  readonly quietZone: number;
  readonly exportPixels: number;
  readonly dpi: number;
}

export interface PrintPlan {
  readonly moduleMm: number;
  readonly minimumWidthMm: number;
  readonly currentWidthMm: number;
  readonly currentModuleMm: number;
  readonly meetsModuleTarget: boolean;
  readonly recommendedScanDistanceCm: number;
}

/**
 * Print planning follows DENSO WAVE's guidance that normal QR codes retain a
 * four-module quiet zone and that stable printing uses at least four printer
 * dots per module. ModuQR deliberately targets five dots/module here to leave
 * a small print-quality buffer. Scan distance is a planning heuristic only.
 */
export function calculatePrintPlan(input: PrintPlanInput): PrintPlan {
  const matrixSize = Math.max(21, Math.round(Number.isFinite(input.matrixSize) ? input.matrixSize : 21));
  const quietZone = Math.max(4, Math.min(16, Math.round(Number.isFinite(input.quietZone) ? input.quietZone : 4)));
  const exportPixels = Math.max(1, Number.isFinite(input.exportPixels) ? input.exportPixels : 1);
  const dpi = Math.max(72, Math.min(4800, Number.isFinite(input.dpi) ? input.dpi : 300));
  const totalModules = matrixSize + quietZone * 2;
  const moduleMm = 25.4 / dpi * 5;
  const minimumWidthMm = totalModules * moduleMm;
  const currentWidthMm = exportPixels / dpi * 25.4;
  const currentModuleMm = currentWidthMm / totalModules;
  const meetsModuleTarget = currentModuleMm + Number.EPSILON >= moduleMm;
  const qrSymbolWidthMm = currentModuleMm * matrixSize;
  const recommendedScanDistanceCm = Math.max(8, Math.min(250, qrSymbolWidthMm));
  return { moduleMm, minimumWidthMm, currentWidthMm, currentModuleMm, meetsModuleTarget, recommendedScanDistanceCm };
}
