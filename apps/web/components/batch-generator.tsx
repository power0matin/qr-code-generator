'use client';

import { encodeMatrix } from '@moduqr/core';
import { PRESETS, findPreset } from '@moduqr/presets';
import { renderQR } from '@moduqr/renderer';
import { Download, FileArchive, FileCheck2, FileUp, LoaderCircle, OctagonX } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { prepareBatchJobs, type BatchInputFormat, type BatchJob } from '@/lib/batch-core';
import { verifyRenderedSvg } from '@/lib/export';
import { svgToCanvas } from '@/lib/qr-image';
import { createStoreZip, type ZipEntry } from '@/lib/zip';

type BatchOutput = 'svg-zip' | 'png-zip' | 'pdf-sheet';

interface WorkerResponse {
  readonly ok: boolean;
  readonly jobs?: readonly BatchJob[];
  readonly error?: string;
}

interface CapacityResult {
  readonly name: string;
  readonly bytes: number;
  readonly encodedChars: number;
  readonly fits: boolean;
  readonly version: number | null;
  readonly message: string;
}

const sampleCsv = `name,url\nExample,https://example.com\nDocs,https://example.com/docs`;

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function blobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed.')), type));
}

async function prepareInWorker(text: string, format: BatchInputFormat, payloadTemplate: string, filenameTemplate: string): Promise<readonly BatchJob[]> {
  if (typeof Worker === 'undefined') return prepareBatchJobs(text, format, payloadTemplate, filenameTemplate);
  return new Promise((resolve, reject) => {
    const worker = new Worker('/batch-worker.js');
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('Batch worker timed out.'));
    }, 15_000);
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (!event.data.ok || !event.data.jobs) reject(new Error(event.data.error ?? 'Batch worker failed.'));
      else resolve(event.data.jobs);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      try { resolve(prepareBatchJobs(text, format, payloadTemplate, filenameTemplate)); }
      catch (error) { reject(error); }
    };
    worker.postMessage({ text, format, payloadTemplate, filenameTemplate });
  });
}

export function BatchGenerator() {
  const [format, setFormat] = useState<BatchInputFormat>('csv');
  const [input, setInput] = useState(sampleCsv);
  const [payloadTemplate, setPayloadTemplate] = useState('{{url}}');
  const [filenameTemplate, setFilenameTemplate] = useState('{{name}}-{{index}}');
  const [presetId, setPresetId] = useState('ink');
  const [output, setOutput] = useState<BatchOutput>('svg-zip');
  const [jobs, setJobs] = useState<readonly BatchJob[]>([]);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [capacity, setCapacity] = useState<CapacityResult | null>(null);
  const cancelled = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const capacityInput = useRef<HTMLInputElement>(null);

  const preset = useMemo(() => findPreset(presetId) ?? PRESETS[0], [presetId]);

  const prepare = async (): Promise<readonly BatchJob[]> => {
    setStatus('Preparing rows in a Web Worker…');
    const prepared = await prepareInWorker(input, format, payloadTemplate, filenameTemplate);
    setJobs(prepared);
    setStatus(`${prepared.length} rows prepared. Preview shows the first 10.`);
    return prepared;
  };

  const onDatasetFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Batch data file must be 2 MB or smaller.');
      const extension = file.name.split('.').pop()?.toLowerCase();
      const detected: BatchInputFormat = extension === 'json' ? 'json' : extension === 'tsv' ? 'tsv' : 'csv';
      setFormat(detected);
      setInput(await file.text());
      setJobs([]);
      setStatus(`${file.name} loaded locally as ${detected.toUpperCase()}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Batch file could not be loaded.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const analyzeFileCapacity = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size === 0) throw new Error('File is empty.');
      if (file.size > 64_000) {
        setCapacity({ name: file.name, bytes: file.size, encodedChars: 0, fits: false, version: null, message: 'Too large for direct QR embedding. Use a stable URL instead.' });
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
      try {
        const matrix = encodeMatrix(dataUrl, 'M');
        setCapacity({ name: file.name, bytes: file.size, encodedChars: dataUrl.length, fits: true, version: matrix.version, message: `Direct embedding fits at error correction M (QR version ${matrix.version}). Test the final physical print before use.` });
      } catch {
        setCapacity({ name: file.name, bytes: file.size, encodedChars: dataUrl.length, fits: false, version: null, message: 'Direct embedding exceeds QR capacity at error correction M. Use a URL instead.' });
      }
    } catch (error) {
      setCapacity({ name: file.name, bytes: file.size, encodedChars: 0, fits: false, version: null, message: error instanceof Error ? error.message : 'File could not be analyzed.' });
    } finally {
      if (capacityInput.current) capacityInput.current.value = '';
    }
  };

  const generate = async () => {
    if (!preset) return;
    cancelled.current = false;
    setBusy(true);
    setProgress(0);
    try {
      const prepared = jobs.length > 0 ? jobs : await prepare();
      const total = prepared.length;
      const prefixWidth = Math.max(3, String(total).length);

      if (output === 'pdf-sheet') {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const columns = 4;
        const rowsPerPage = 5;
        const perPage = columns * rowsPerPage;
        const marginX = 10;
        const marginY = 12;
        const cellW = (210 - marginX * 2) / columns;
        const cellH = (297 - marginY * 2) / rowsPerPage;
        const qrSize = Math.min(cellW - 8, cellH - 13);

        for (let index = 0; index < total; index += 1) {
          if (cancelled.current) throw new Error('Batch generation cancelled.');
          const job = prepared[index];
          if (!job) continue;
          const rendered = renderQR(job.payload, preset.style);
          if (!await verifyRenderedSvg(rendered.svg, job.payload, 420)) throw new Error(`Row ${index + 1} failed decode verification with preset “${preset.name}”.`);
          const canvas = await svgToCanvas(rendered.svg, 640, false, '#ffffff');
          if (index > 0 && index % perPage === 0) pdf.addPage();
          const pageIndex = index % perPage;
          const col = pageIndex % columns;
          const row = Math.floor(pageIndex / columns);
          const x = marginX + col * cellW + (cellW - qrSize) / 2;
          const y = marginY + row * cellH + 2;
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, qrSize, qrSize, undefined, 'FAST');
          pdf.setFontSize(7);
          pdf.text(job.filename.slice(0, 32), marginX + col * cellW + cellW / 2, y + qrSize + 4, { align: 'center', maxWidth: cellW - 4 });
          setProgress(Math.round((index + 1) / total * 100));
          if ((index + 1) % 3 === 0) await yieldToBrowser();
        }
        downloadBlob(pdf.output('blob'), `moduqr-batch-${total}.pdf`);
      } else {
        const entries: ZipEntry[] = [];
        for (let index = 0; index < total; index += 1) {
          if (cancelled.current) throw new Error('Batch generation cancelled.');
          const job = prepared[index];
          if (!job) continue;
          const rendered = renderQR(job.payload, preset.style);
          if (!await verifyRenderedSvg(rendered.svg, job.payload, 420)) throw new Error(`Row ${index + 1} failed decode verification with preset “${preset.name}”.`);
          const prefix = String(index + 1).padStart(prefixWidth, '0');
          if (output === 'svg-zip') {
            entries.push({ name: `${prefix}-${job.filename}.svg`, data: new TextEncoder().encode(rendered.svg) });
          } else {
            const canvas = await svgToCanvas(rendered.svg, 768, false, '#ffffff');
            const png = await canvasBlob(canvas, 'image/png');
            entries.push({ name: `${prefix}-${job.filename}.png`, data: new Uint8Array(await png.arrayBuffer()) });
          }
          setProgress(Math.round((index + 1) / total * 100));
          if ((index + 1) % 4 === 0) await yieldToBrowser();
        }
        const zip = createStoreZip(entries);
        downloadBlob(new Blob([blobPart(zip)], { type: 'application/zip' }), `moduqr-batch-${total}.zip`);
      }
      setStatus(`Batch complete: ${prepared.length} verified QR codes exported.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Batch generation failed.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="batch-layout">
    <section className="panel batch-panel" aria-labelledby="batch-title">
      <div className="panel-header"><div><span className="eyebrow">Phase 2 · local batch</span><h1 id="batch-title">Batch QR Generator</h1><p>Prepare up to 500 QR codes from CSV, TSV or JSON without uploading the dataset.</p></div></div>
      <div className="form-stack">
        <div className="batch-toolbar"><div className="field"><label htmlFor="batch-format">Input format</label><select id="batch-format" className="select" value={format} onChange={(event) => { setFormat(event.target.value as BatchInputFormat); setJobs([]); }}><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option></select></div><button className="button" type="button" onClick={() => fileInput.current?.click()}><FileUp size={15}/>Load file</button><input ref={fileInput} hidden type="file" accept=".csv,.tsv,.json,text/csv,text/tab-separated-values,application/json" onChange={(event) => void onDatasetFile(event.target.files?.[0])}/></div>
        <div className="field"><label htmlFor="batch-data">Dataset</label><textarea id="batch-data" className="textarea batch-textarea" value={input} onChange={(event) => { setInput(event.target.value); setJobs([]); }} spellCheck={false}/><span className="help">CSV/TSV first row is treated as headers. JSON accepts an array of objects or primitive values.</span></div>
        <div className="field"><label htmlFor="payload-template">Payload template</label><input id="payload-template" className="input" value={payloadTemplate} onChange={(event) => { setPayloadTemplate(event.target.value); setJobs([]); }} placeholder="https://example.com/{{slug}}"/><span className="help">Use variables such as <code>{'{{url}}'}</code>, <code>{'{{name}}'}</code> and <code>{'{{index}}'}</code>.</span></div>
        <div className="field"><label htmlFor="filename-template">Filename template</label><input id="filename-template" className="input" value={filenameTemplate} onChange={(event) => { setFilenameTemplate(event.target.value); setJobs([]); }} placeholder="qr-{{index}}"/></div>
        <div className="batch-toolbar"><div className="field"><label htmlFor="batch-preset">Preset</label><select id="batch-preset" className="select" value={presetId} onChange={(event) => setPresetId(event.target.value)}>{PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></div><div className="field"><label htmlFor="batch-output">Output</label><select id="batch-output" className="select" value={output} onChange={(event) => setOutput(event.target.value as BatchOutput)}><option value="svg-zip">SVG ZIP</option><option value="png-zip">PNG ZIP</option><option value="pdf-sheet">PDF sheet</option></select></div></div>
        <div className="project-actions"><button className="button" type="button" disabled={busy} onClick={() => void prepare()}><FileCheck2 size={15}/>Prepare & preview</button><button className="button accent" type="button" disabled={busy} onClick={() => void generate()}>{busy ? <LoaderCircle className="spin" size={15}/> : output === 'pdf-sheet' ? <Download size={15}/> : <FileArchive size={15}/>}Generate</button>{busy ? <button className="button danger" type="button" onClick={() => { cancelled.current = true; }}><OctagonX size={15}/>Cancel</button> : null}</div>
        {busy ? <div className="progress-wrap" aria-live="polite"><progress max={100} value={progress}/><span>{progress}%</span></div> : null}
        {status ? <p className="help" role="status">{status}</p> : null}
      </div>
    </section>

    <aside className="panel batch-preview-panel">
      <div className="panel-header"><div><h2>Preview</h2><p>{jobs.length > 0 ? `${jobs.length} prepared rows` : 'Prepare rows to validate templates.'}</p></div></div>
      {jobs.length > 0 ? <div className="batch-preview-list">{jobs.slice(0, 10).map((job) => <div className="batch-preview-row" key={job.index}><strong>{job.index + 1}. {job.filename}</strong><span>{job.payload}</span></div>)}</div> : <div className="scanner-result"><strong>No prepared rows yet</strong><p>The Worker validates row count and template output before rendering.</p></div>}
      {jobs.length > 10 ? <p className="help">…and {jobs.length - 10} more rows.</p> : null}
      <div className="divider"/>
      <section aria-labelledby="capacity-title"><div className="panel-header"><div><h2 id="capacity-title">Image / file capacity analyzer</h2><p>Validates whether a small file can actually fit directly inside a QR payload.</p></div></div><button className="button" type="button" onClick={() => capacityInput.current?.click()}><FileUp size={15}/>Analyze local file</button><input ref={capacityInput} hidden type="file" onChange={(event) => void analyzeFileCapacity(event.target.files?.[0])}/>{capacity ? <div className={capacity.fits ? 'success-box' : 'issue warning'}><strong>{capacity.name} · {capacity.bytes.toLocaleString()} bytes</strong><span>{capacity.message}</span>{capacity.encodedChars > 0 ? <span>Encoded data URL: {capacity.encodedChars.toLocaleString()} characters.</span> : null}</div> : <p className="help">For normal images/PDFs, a stable URL is still preferred. This tool only validates genuinely small embedded payloads.</p>}</section>
    </aside>
  </div>;
}
