import { readFile } from 'node:fs/promises';
import path from 'node:path';

const reportPath = path.resolve('apps/web/test-results/results.json');

let report;
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Playwright JSON report is missing or invalid at ${reportPath}: ${detail}`);
}

const stats = report?.stats;
if (!stats || !['expected', 'skipped', 'unexpected', 'flaky'].every((key) => Number.isSafeInteger(stats[key]) && stats[key] >= 0)) {
  throw new Error('Playwright JSON report does not contain valid expected/skipped/unexpected/flaky statistics.');
}

console.log(`Playwright acceptance: ${stats.expected} passed, ${stats.skipped} skipped, ${stats.unexpected} unexpected, ${stats.flaky} flaky.`);

if (stats.unexpected > 0 || stats.flaky > 0) {
  throw new Error('Release gate requires zero unexpected and zero retry-flaky Playwright tests.');
}
