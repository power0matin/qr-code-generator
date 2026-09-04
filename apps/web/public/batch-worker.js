/* ModuQR Phase 2 batch preparation worker. No network access; no imports. */
'use strict';

const MAX_ROWS = 500;
const MAX_INPUT_CHARS = 2000000;
const MAX_PAYLOAD_CHARS = 12000;
const MAX_TEMPLATE_CHARS = 4000;

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char || '';
      continue;
    }
    if (char === '"') {
      if (field.length !== 0) throw new Error(`Unexpected quote at character ${index + 1}.`);
      quoted = true;
    } else if (char === delimiter) {
      row.push(field); field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char || '';
  }
  if (quoted) throw new Error('Unclosed quoted field in batch data.');
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const nonBlank = rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
  if (!nonBlank[0]) throw new Error('Batch data is empty.');
  const headers = nonBlank[0].map((header, index) => header.replace(/^\uFEFF/, '').trim() || `column${index + 1}`);
  const seen = new Set();
  for (const header of headers) {
    const key = header.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate batch header “${header}”.`);
    seen.add(key);
  }
  return nonBlank.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])));
}

function scalar(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try { return JSON.stringify(value); } catch { return ''; }
}

function parseRows(text, format) {
  if (!text) throw new Error('Batch data is empty.');
  if (text.length > MAX_INPUT_CHARS) throw new Error('Batch data exceeds the 2 MB text limit.');
  let rows;
  if (format === 'json') {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Batch JSON is invalid.'); }
    if (!Array.isArray(parsed)) throw new Error('Batch JSON must be an array.');
    rows = parsed.map((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, scalar(value)]));
      }
      return { value: scalar(item) };
    });
  } else if (format === 'tsv') rows = parseDelimited(text, '\t');
  else if (format === 'csv') rows = parseDelimited(text, ',');
  else throw new Error('Unsupported batch input format.');
  if (rows.length === 0) throw new Error('Batch data contains no data rows.');
  if (rows.length > MAX_ROWS) throw new Error(`Batch is limited to ${MAX_ROWS} rows per run.`);
  return rows;
}

function template(value, values, index) {
  if (!value.trim()) throw new Error('Template cannot be empty.');
  if (value.length > MAX_TEMPLATE_CHARS) throw new Error('Template is too long.');
  const merged = Object.assign(Object.create(null), values, { index: String(index + 1), zeroIndex: String(index) });
  return value.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_match, key) => Object.prototype.hasOwnProperty.call(merged, key) ? merged[key] || '' : '');
}

function filename(value, index) {
  const normalized = value.normalize('NFKC').trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, '-').replace(/\.{2,}/g, '.').replace(/^-+|-+$/g, '').slice(0, 96);
  return normalized || `qr-${index + 1}`;
}

self.onmessage = (event) => {
  try {
    const data = event.data || {};
    const rows = parseRows(String(data.text || ''), data.format);
    const jobs = rows.map((values, index) => {
      const payload = template(String(data.payloadTemplate || ''), values, index).trim();
      if (!payload) throw new Error(`Row ${index + 1} produced an empty payload.`);
      if (payload.length > MAX_PAYLOAD_CHARS) throw new Error(`Row ${index + 1} exceeds the ${MAX_PAYLOAD_CHARS.toLocaleString()} character payload limit.`);
      return { index, payload, filename: filename(template(String(data.filenameTemplate || 'qr-{{index}}'), values, index), index), values };
    });
    self.postMessage({ ok: true, jobs });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Batch worker failed.' });
  }
};
