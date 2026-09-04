import { describe, expect, it } from 'vitest';
import { calculatePrintPlan } from './print-safety';

describe('print safety planning', () => {
  it('uses a four-module quiet-zone floor and five-dot print target', () => {
    const plan = calculatePrintPlan({ matrixSize: 29, quietZone: 1, exportPixels: 185, dpi: 300 });
    expect(plan.moduleMm).toBeCloseTo(25.4 / 300 * 5, 6);
    expect(plan.minimumWidthMm).toBeCloseTo((29 + 8) * plan.moduleMm, 6);
  });

  it('reports whether the export meets the selected print target', () => {
    const small = calculatePrintPlan({ matrixSize: 177, quietZone: 4, exportPixels: 512, dpi: 600 });
    const large = calculatePrintPlan({ matrixSize: 21, quietZone: 4, exportPixels: 4096, dpi: 300 });
    expect(small.meetsModuleTarget).toBe(false);
    expect(large.meetsModuleTarget).toBe(true);
  });
});
