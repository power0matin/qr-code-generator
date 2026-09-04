export type BatchInputFormat = 'csv' | 'tsv' | 'json';

export interface BatchJob {
  readonly index: number;
  readonly payload: string;
  readonly filename: string;
  readonly values: Readonly<Record<string, string>>;
}

export const MAX_BATCH_ROWS = 500;
const MAX_INPUT_CHARS = 2_000_000;
const MAX_PAYLOAD_CHARS = 12_000;
const MAX_TEMPLATE_CHARS = 4_000;
const MAX_FILENAME_CHARS = 96;

function scalarToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try { return JSON.stringify(value); } catch { return ''; }
}

function parseDelimited(text: string, delimiter: ',' | '\t'): readonly Readonly<Record<string, string>>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char ?? '';
      }
      continue;
    }
    if (char === '"') {
      if (field.length !== 0) throw new Error(`Unexpected quote at character ${index + 1}.`);
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\r') {
      if (text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char ?? '';
    }
  }
  if (quoted) throw new Error('Unclosed quoted field in batch data.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonBlank = rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
  const headerRow = nonBlank[0];
  if (!headerRow) throw new Error('Batch data is empty.');
  const headers = headerRow.map((header, index) => header.replace(/^\uFEFF/, '').trim() || `column${index + 1}`);
  const seen = new Set<string>();
  for (const header of headers) {
    const key = header.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate batch header “${header}”.`);
    seen.add(key);
  }

  return nonBlank.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = cells[index] ?? ''; });
    return record;
  });
}

function parseJsonRows(text: string): readonly Readonly<Record<string, string>>[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; }
  catch { throw new Error('Batch JSON is invalid.'); }
  if (!Array.isArray(parsed)) throw new Error('Batch JSON must be an array.');
  return parsed.map((item) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const record: Record<string, string> = {};
      for (const [key, value] of Object.entries(item)) record[key] = scalarToString(value);
      return record;
    }
    return { value: scalarToString(item) };
  });
}

export function parseBatchRows(text: string, format: BatchInputFormat): readonly Readonly<Record<string, string>>[] {
  if (text.length === 0) throw new Error('Batch data is empty.');
  if (text.length > MAX_INPUT_CHARS) throw new Error('Batch data exceeds the 2 MB text limit.');
  const rows = format === 'json' ? parseJsonRows(text) : parseDelimited(text, format === 'tsv' ? '\t' : ',');
  if (rows.length === 0) throw new Error('Batch data contains no data rows.');
  if (rows.length > MAX_BATCH_ROWS) throw new Error(`Batch is limited to ${MAX_BATCH_ROWS} rows per run.`);
  return rows;
}

function renderTemplate(template: string, values: Readonly<Record<string, string>>, index: number): string {
  if (!template.trim()) throw new Error('Template cannot be empty.');
  if (template.length > MAX_TEMPLATE_CHARS) throw new Error('Template is too long.');
  const withBuiltins = Object.assign(Object.create(null) as Record<string, string>, values, {
    index: String(index + 1),
    zeroIndex: String(index),
  });
  return template.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(withBuiltins, key) ? withBuiltins[key] ?? '' : '',
  );
}

function safeFilename(value: string, index: number): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILENAME_CHARS);
  return normalized || `qr-${index + 1}`;
}

export function prepareBatchJobs(
  text: string,
  format: BatchInputFormat,
  payloadTemplate: string,
  filenameTemplate: string,
): readonly BatchJob[] {
  const rows = parseBatchRows(text, format);
  return rows.map((values, index) => {
    const payload = renderTemplate(payloadTemplate, values, index).trim();
    if (!payload) throw new Error(`Row ${index + 1} produced an empty payload.`);
    if (payload.length > MAX_PAYLOAD_CHARS) throw new Error(`Row ${index + 1} exceeds the ${MAX_PAYLOAD_CHARS.toLocaleString()} character payload limit.`);
    const filename = safeFilename(renderTemplate(filenameTemplate || 'qr-{{index}}', values, index), index);
    return { index, payload, filename, values };
  });
}
