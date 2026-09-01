'use client';

import { parseDesignDocument } from '@moduqr/core';
import { PRESETS } from '@moduqr/presets';
import { renderQR } from '@moduqr/renderer';
import { evaluateSafety } from '@moduqr/scan-validator';
import { DESIGN_SCHEMA_VERSION, type QRDesignDocument } from '@moduqr/shared';
import { Download, FileDown, Redo2, RotateCcw, Save, Sparkles, Undo2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesignPanel } from './design-panel';
import { PayloadEditor } from './payload-editor';
import { exportQR, verifyRenderedSvg, type ExportFormat } from '@/lib/export';
import { makeProject, saveProject } from '@/lib/projects';
import { useStudioStore } from '@/lib/studio-store';

export function Studio() {
  const payloadType = useStudioStore((state) => state.payloadType);
  const payload = useStudioStore((state) => state.payload);
  const style = useStudioStore((state) => state.style);
  const presetId = useStudioStore((state) => state.presetId);
  const past = useStudioStore((state) => state.past);
  const future = useStudioStore((state) => state.future);
  const undo = useStudioStore((state) => state.undo);
  const redo = useStudioStore((state) => state.redo);
  const reset = useStudioStore((state) => state.reset);
  const setStyle = useStudioStore((state) => state.setStyle);
  const load = useStudioStore((state) => state.load);
  const rendered = useMemo(() => renderQR(payload || ' ', style), [payload, style]);
  const [decodeSnapshot, setDecodeSnapshot] = useState<{ readonly svg: string; readonly payload: string; readonly result: boolean } | null>(null);
  const decoded = decodeSnapshot?.svg === rendered.svg && decodeSnapshot.payload === payload ? decodeSnapshot.result : null;
  const [status, setStatus] = useState('');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [width, setWidth] = useState(1024);
  const [transparent, setTransparent] = useState(false);
  const [projectName, setProjectName] = useState('Untitled QR');
  const [activeProject, setActiveProject] = useState<{ readonly id: string; readonly createdAt: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('moduqr-load-project');
    if (!stored) return;
    sessionStorage.removeItem('moduqr-load-project');

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const project = parseDesignDocument(JSON.parse(stored) as unknown);
        setProjectName(project.name);
        setActiveProject({ id: project.id, createdAt: project.createdAt });
        load({ payloadType: project.payloadType, payload: project.payload, style: project.style, presetId: project.presetId });
        setStatus('Local project loaded.');
      } catch {
        setStatus('The selected local project could not be loaded.');
      }
    });

    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    const svg = rendered.svg;
    const currentPayload = payload;
    const timer = setTimeout(() => {
      void verifyRenderedSvg(svg, currentPayload, 768)
        .then((result) => {
          if (active) setDecodeSnapshot({ svg, payload: currentPayload, result });
        })
        .catch(() => {
          if (active) setDecodeSnapshot({ svg, payload: currentPayload, result: false });
        });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rendered.svg, payload]);

  const safety = useMemo(() => evaluateSafety({ payload, style, outputWidth: width, decoded }), [payload, style, width, decoded]);

  const currentDocument = (): QRDesignDocument => {
    const now = new Date().toISOString();
    return {
      version: DESIGN_SCHEMA_VERSION,
      id: activeProject?.id ?? crypto.randomUUID(),
      name: projectName.trim() || 'Untitled QR',
      payloadType,
      payload,
      style,
      presetId,
      favorite: false,
      createdAt: activeProject?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const saveCurrent = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const project = activeProject ? { version: DESIGN_SCHEMA_VERSION, id: activeProject.id, name: projectName.trim() || 'Untitled QR', payloadType, payload, style, presetId, favorite: false, createdAt: activeProject.createdAt, updatedAt: now } satisfies QRDesignDocument : makeProject({ name: projectName.trim() || 'Untitled QR', payloadType, payload, style, presetId, favorite: false });
      await saveProject(project);
      setActiveProject({ id: project.id, createdAt: project.createdAt });
      setStatus('Saved locally on this device.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this project.');
    }
  }, [activeProject, payload, payloadType, presetId, projectName, style]);

  const exportDesignJson = () => {
    const blob = new Blob([JSON.stringify(currentDocument(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug(projectName)}.moduqr.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importDesign = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 4_000_000) throw new Error('Design file is too large.');
      const documentValue = parseDesignDocument(JSON.parse(await file.text()) as unknown);
      setProjectName(documentValue.name);
      setActiveProject(null);
      load({ payloadType: documentValue.payloadType, payload: documentValue.payload, style: documentValue.style, presetId: documentValue.presetId });
      setStatus('Design imported.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invalid ModuQR design file.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const surprise = useCallback(() => {
    const seed = [...payload].reduce((sum, char) => (sum + char.charCodeAt(0)) % 100003, 0) + Date.now();
    const selected = PRESETS[seed % PRESETS.length];
    if (selected) setStyle(selected.style, selected.id);
  }, [payload, setStyle]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input,textarea,select,[contenteditable=true]') ?? false;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); redo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveCurrent(); }
      if (!typing && event.key.toLowerCase() === 'r' && event.altKey) { event.preventDefault(); surprise(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, saveCurrent, surprise, undo]);

  const doExport = async () => {
    try {
      setStatus('Verifying export…');
      await exportQR({ svg: rendered.svg, payload, format, width, filename: slug(projectName), transparent });
      setStatus('Export verified and downloaded.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  return <section className="studio-shell" aria-label="QR code designer">
    <div className="studio-toolbar">
      <div className="title-group"><h1>QR Studio</h1><p>{payloadType.toUpperCase()} · local-only static QR</p></div>
      <button type="button" className="button ghost" onClick={undo} disabled={past.length === 0} aria-label="Undo design" title="Undo (Ctrl/⌘ Z)"><Undo2 size={16}/><span>Undo</span></button>
      <button type="button" className="button ghost" onClick={redo} disabled={future.length === 0} aria-label="Redo design" title="Redo"><Redo2 size={16}/><span>Redo</span></button>
      <button type="button" className="button ghost" onClick={surprise} aria-label="Surprise me" title="Surprise me (Alt R)"><Sparkles size={16}/><span>Surprise</span></button>
      <button type="button" className="button ghost" onClick={reset} aria-label="Reset design" title="Reset design"><RotateCcw size={16}/><span>Reset</span></button>
    </div>
    <div className="studio-grid">
      <aside className="panel"><div className="panel-scroll"><PayloadEditor /></div></aside>
      <section className="panel canvas-panel" aria-label="Live QR preview">
        <div className="canvas-stage"><div className="qr-paper" dangerouslySetInnerHTML={{ __html: rendered.svg }}/></div>
        <div className="canvas-meta"><small>Version {Math.floor((rendered.matrixSize - 17) / 4)} · {rendered.matrixSize}×{rendered.matrixSize} modules</small><span className="score-pill" aria-label="Decode status" aria-live="polite">{decoded === null ? 'Checking…' : decoded ? '✓ Decodes' : 'Decode failed'}</span></div>
      </section>
      <aside className="panel"><div className="panel-scroll"><DesignPanel /><div className="divider"/><Safety score={safety.score} grade={safety.grade} issues={safety.issues}/><div className="divider"/><ExportPanel format={format} setFormat={setFormat} width={width} setWidth={setWidth} transparent={transparent} setTransparent={setTransparent} projectName={projectName} setProjectName={setProjectName} onExport={() => void doExport()} onSave={() => void saveCurrent()} onExportJson={exportDesignJson} onImport={() => importRef.current?.click()} status={status}/><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importDesign(event.target.files?.[0])}/></div></aside>
    </div>
  </section>;
}

function Safety({ score, grade, issues }: Readonly<{ score: number; grade: string; issues: readonly { readonly code: string; readonly severity: string; readonly message: string; readonly fix: string }[] }>) {
  return <section aria-labelledby="safety-title"><div className="panel-header"><div><h2 id="safety-title">Scan Safety</h2><p>Heuristics + rendered decode check.</p></div></div><div className="safety-score"><div className="score-ring" style={{ '--score': score } as React.CSSProperties}><strong>{score}</strong></div><div><strong>{grade}</strong><p className="help">A failing real decode carries the strongest penalty.</p></div></div>{issues.length === 0 ? <div className="success-box">No safety issues detected at this output size.</div> : <div className="issue-list">{issues.map((issue) => <div className={`issue ${issue.severity}`} key={issue.code}><strong>{issue.message}</strong><span>{issue.fix}</span></div>)}</div>}</section>;
}

function ExportPanel(props: Readonly<{ format: ExportFormat; setFormat: (value: ExportFormat) => void; width: number; setWidth: (value: number) => void; transparent: boolean; setTransparent: (value: boolean) => void; projectName: string; setProjectName: (value: string) => void; onExport: () => void; onSave: () => void; onExportJson: () => void; onImport: () => void; status: string }>) {
  return <section aria-labelledby="export-title"><div className="panel-header"><div><h2 id="export-title">Export & project</h2><p>Every download is preflight-decoded.</p></div></div><div className="form-stack"><div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" className="input" value={props.projectName} onChange={(event) => props.setProjectName(event.target.value)} maxLength={120}/></div><div className="field"><label htmlFor="format">Format</label><select id="format" className="select" value={props.format} onChange={(event) => props.setFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="svg">SVG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select></div><div className="field"><label htmlFor="resolution">Resolution</label><input id="resolution" className="input" type="number" inputMode="numeric" min={256} max={8192} step={1} value={props.width} onChange={(event) => props.setWidth(Math.max(256, Math.min(8192, Number(event.target.value) || 256)))}/><div className="style-grid" aria-label="Export resolution presets">{[512,1024,2048,4096].map((value) => <button type="button" className="button ghost" key={value} aria-pressed={props.width === value} onClick={() => props.setWidth(value)}>{value}px</button>)}</div><span className="help">Custom: 256–8192 px · at 300 DPI this is approximately {(props.width / 300 * 25.4).toFixed(1)} mm wide before frame aspect-ratio adjustment.</span></div><label className="field-label"><input type="checkbox" checked={props.transparent} disabled={props.format === 'jpeg' || props.format === 'pdf'} onChange={(event) => props.setTransparent(event.target.checked)}/> Transparent background</label><button type="button" className="button accent" onClick={props.onExport}><Download size={16}/> Verify & download</button><button type="button" className="button" onClick={props.onSave}><Save size={16}/> Save locally</button><div className="style-grid"><button type="button" className="button ghost" onClick={props.onExportJson}><FileDown size={15}/> JSON</button><button type="button" className="button ghost" onClick={props.onImport}><Upload size={15}/> Import</button></div>{props.status ? <div className="help" aria-live="polite">{props.status}</div> : null}</div></section>;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'moduqr';
}
