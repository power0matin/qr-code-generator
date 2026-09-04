import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('apps/web/.next/static/chunks');
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_SINGLE_BYTES = 1500 * 1024;

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(absolute));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  }
  return files;
}

try {
  const files = await filesUnder(root);
  if (files.length === 0) throw new Error('No production JavaScript chunks were found after build.');
  let total = 0;
  let largest = { file: '', size: 0 };
  for (const file of files) {
    const size = (await stat(file)).size;
    total += size;
    if (size > largest.size) largest = { file, size };
  }
  const mb = (value) => (value / 1024 / 1024).toFixed(2);
  console.log(`Bundle audit: ${files.length} JS chunks, ${mb(total)} MiB total, largest ${mb(largest.size)} MiB (${path.relative(process.cwd(), largest.file)}).`);
  if (total > MAX_TOTAL_BYTES) throw new Error(`Production JS total ${mb(total)} MiB exceeds the 5 MiB Phase 2 budget.`);
  if (largest.size > MAX_SINGLE_BYTES) throw new Error(`Largest JS chunk ${mb(largest.size)} MiB exceeds the 1.46 MiB Phase 2 budget.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
