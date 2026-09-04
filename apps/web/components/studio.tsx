'use client';

import { parseDesignDocument } from '@moduqr/core';
import { PRESETS } from '@moduqr/presets';
import { renderQR } from '@moduqr/renderer';
import { autoFixStyle, evaluateSafety } from '@moduqr/scan-validator';
import { DESIGN_SCHEMA_VERSION, type ProjectRevision, type QRDesignDocument, type SafetySimulationResult } from '@moduqr/shared';
import { Copy, Download, FileDown, History, Redo2, RotateCcw, Save, Share2, ShieldCheck, Sparkles, Undo2, Upload, WandSparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesignPanel } from './design-panel';
import { PayloadEditor } from './payload-editor';
import { createDesignShareUrl, readDesignShareFromHash } from '@/lib/design-share';
import { exportQR, verifyRenderedSvg, type ExportFormat } from '@/lib/export';
import { calculatePrintPlan } from '@/lib/print-safety';
import { getProject, listProjectHistory, makeProject, saveProject } from '@/lib/projects';
import { runSafetySimulations } from '@/lib/safety-simulations';
import { useStudioStore } from '@/lib/studio-store';

interface ActiveProject {
  readonly id: string;
  readonly createdAt: string;
  readonly favorite: boolean;
  readonly revision: number;
}

interface SimulationSnapshot {
  readonly svg: string;
  readonly payload: string;
  readonly results: readonly SafetySimulationResult[];
}

type Mockup = 'card' | 'poster' | 'phone' | 'package';

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

  const renderState = useMemo(() => {
    try {
      return { rendered: renderQR(payload, style), error: null } as const;
    } catch (error) {
      return { rendered: null, error: error instanceof Error ? error.message : 'The QR could not be rendered.' } as const;
    }
  }, [payload, style]);
  const rendered = renderState.rendered;

  const [decodeSnapshot, setDecodeSnapshot] = useState<{ readonly svg: string; readonly payload: string; readonly result: boolean } | null>(null);
  const decoded = rendered && decodeSnapshot?.svg === rendered.svg && decodeSnapshot.payload === payload ? decodeSnapshot.result : null;
  const [simulationSnapshot, setSimulationSnapshot] = useState<SimulationSnapshot | null>(null);
  const simulations = rendered && simulationSnapshot?.svg === rendered.svg && simulationSnapshot.payload === payload ? simulationSnapshot.results : undefined;
  const [simulating, setSimulating] = useState(false);
  const [status, setStatus] = useState('');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [width, setWidth] = useState(1024);
  const [dpi, setDpi] = useState(300);
  const [transparent, setTransparent] = useState(false);
  const [projectName, setProjectName] = useState('Untitled QR');
  const [projectTags, setProjectTags] = useState<readonly string[]>([]);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);
  const [history, setHistory] = useState<readonly ProjectRevision[]>([]);
  const [mockup, setMockup] = useState<Mockup>('card');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let projectId: string | null = null;
    let legacyStored: string | null = null;
    try {
      projectId = window.sessionStorage.getItem('moduqr-load-project-id');
      legacyStored = window.sessionStorage.getItem('moduqr-load-project');
    } catch {
      return;
    }

    if (!projectId && !legacyStored) {
      let active = true;
      const task = window.setTimeout(() => {
        if (!active) return;
        try {
          const shared = readDesignShareFromHash(window.location.hash);
          if (shared) {
            setStyle(shared.style, shared.presetId);
            setStatus('Shared design styling loaded. Payload content was not included in the link.');
          }
        } catch (error) {
          setStatus(error instanceof Error ? `Shared design blocked: ${error.message}` : 'Shared design could not be loaded.');
        }
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(task);
      };
    }

    let active = true;
    queueMicrotask(() => {
      void (async () => {
        try {
          const project = projectId
            ? await getProject(projectId)
            : parseDesignDocument(JSON.parse(legacyStored ?? '') as unknown);
          if (!project) throw new Error('The selected local project no longer exists.');
          if (!active) return;
          try {
            if (projectId) window.sessionStorage.removeItem('moduqr-load-project-id');
            if (legacyStored) window.sessionStorage.removeItem('moduqr-load-project');
          } catch {
            // Project is already in memory; cleanup is best effort.
          }
          setProjectName(project.name);
          setProjectTags(project.tags);
          setActiveProject({ id: project.id, createdAt: project.createdAt, favorite: project.favorite, revision: project.revision });
          load({ payloadType: project.payloadType, payload: project.payload, style: project.style, presetId: project.presetId });
          setHistory(await listProjectHistory(project.id));
          setStatus(`Local project loaded · revision ${project.revision}.`);
        } catch {
          if (active) setStatus('The selected local project could not be loaded.');
        }
      })();
    });

    return () => { active = false; };
  }, [load, setStyle]);

  useEffect(() => {
    if (!rendered) return;
    let active = true;
    const svg = rendered.svg;
    const currentPayload = payload;
    const timer = setTimeout(() => {
      void verifyRenderedSvg(svg, currentPayload, 768)
        .then((result) => { if (active) setDecodeSnapshot({ svg, payload: currentPayload, result }); })
        .catch(() => { if (active) setDecodeSnapshot({ svg, payload: currentPayload, result: false }); });
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [payload, rendered]);

  const safetyRenderWidth = rendered?.viewBoxWidth ?? 640;
  const safety = useMemo(
    () => evaluateSafety({ payload, style, outputWidth: width, renderWidth: safetyRenderWidth, decoded, simulations }),
    [decoded, payload, safetyRenderWidth, simulations, style, width],
  );

  const printPlan = useMemo(() => rendered ? calculatePrintPlan({ matrixSize: rendered.matrixSize, quietZone: style.quietZone, exportPixels: width, dpi }) : null, [dpi, rendered, style.quietZone, width]);

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
      favorite: activeProject?.favorite ?? false,
      tags: projectTags,
      revision: activeProject?.revision ?? 1,
      createdAt: activeProject?.createdAt ?? now,
      updatedAt: now,
    };
  };

  const saveCurrent = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const project = activeProject
        ? {
            version: DESIGN_SCHEMA_VERSION,
            id: activeProject.id,
            name: projectName.trim() || 'Untitled QR',
            payloadType,
            payload,
            style,
            presetId,
            favorite: activeProject.favorite,
            tags: projectTags,
            revision: activeProject.revision + 1,
            createdAt: activeProject.createdAt,
            updatedAt: now,
          } satisfies QRDesignDocument
        : makeProject({ name: projectName.trim() || 'Untitled QR', payloadType, payload, style, presetId, favorite: false, tags: projectTags });
      await saveProject(project);
      setActiveProject({ id: project.id, createdAt: project.createdAt, favorite: project.favorite, revision: project.revision });
      setHistory(await listProjectHistory(project.id));
      setStatus(`Saved locally · revision ${project.revision}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this project.');
    }
  }, [activeProject, payload, payloadType, presetId, projectName, projectTags, style]);

  const exportDesignJson = () => {
    try {
      const documentValue = parseDesignDocument(currentDocument());
      const blob = new Blob([JSON.stringify(documentValue, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug(projectName)}.moduqr.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus('Design JSON validated and downloaded.');
    } catch (error) {
      setStatus(error instanceof Error ? `Design JSON blocked: ${error.message}` : 'Design JSON could not be validated.');
    }
  };

  const importDesign = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 4_000_000) throw new Error('Design file is too large.');
      if (file.size === 0) throw new Error('Design file is empty.');
      const documentValue = parseDesignDocument(JSON.parse(await file.text()) as unknown);
      setProjectName(documentValue.name);
      setProjectTags(documentValue.tags);
      setActiveProject(null);
      setHistory([]);
      load({ payloadType: documentValue.payloadType, payload: documentValue.payload, style: documentValue.style, presetId: documentValue.presetId });
      setStatus(`Design schema v${documentValue.version} imported as a new local design.`);
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

  const copyDesignLink = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API is unavailable.');
      const url = createDesignShareUrl(style, presetId);
      await navigator.clipboard.writeText(url);
      setStatus('Design-only link copied. Payload and embedded logo bytes are not included.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not copy the design link.');
    }
  }, [presetId, style]);

  const runSimulations = async () => {
    if (!rendered) return;
    setSimulating(true);
    setStatus('Running camera/print stress simulations locally…');
    try {
      const results = await runSafetySimulations(rendered.svg, payload);
      setSimulationSnapshot({ svg: rendered.svg, payload, results });
      const passed = results.filter((result) => result.decoded).length;
      setStatus(`Stress tests complete: ${passed}/${results.length} conditions decoded.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Stress simulations failed.');
    } finally {
      setSimulating(false);
    }
  };

  const autoFix = () => {
    const fixed = autoFixStyle(style, safety);
    setStyle(fixed, null);
    setSimulationSnapshot(null);
    setStatus('Scan-first Auto Fix applied. Run stress tests again to verify the result.');
  };

  const restoreRevision = (revision: ProjectRevision) => {
    const project = revision.document;
    setProjectName(project.name);
    setProjectTags(project.tags);
    load({ payloadType: project.payloadType, payload: project.payload, style: project.style, presetId: project.presetId });
    setStatus(`Revision ${revision.revision} restored as a working copy. Save to create a new latest revision.`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches('input,textarea,select,[contenteditable=true]') ?? false;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); redo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveCurrent(); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') { event.preventDefault(); void copyDesignLink(); }
      if (!typing && event.key.toLowerCase() === 'r' && event.altKey) { event.preventDefault(); surprise(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copyDesignLink, redo, saveCurrent, surprise, undo]);

  const doExport = async () => {
    if (!rendered) {
      setStatus(`Export blocked: ${renderState.error ?? 'the QR could not be rendered.'}`);
      return;
    }
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
      <button type="button" className="button ghost" onClick={() => void copyDesignLink()} aria-label="Copy design-only share link" title="Copy design link (Ctrl/⌘ Shift C)"><Share2 size={16}/><span>Share design</span></button>
      <button type="button" className="button ghost" onClick={reset} aria-label="Reset design" title="Reset design"><RotateCcw size={16}/><span>Reset</span></button>
    </div>
    <div className="studio-grid">
      <aside className="panel"><div className="panel-scroll"><PayloadEditor /></div></aside>
      <section className="panel canvas-panel" aria-label="Live QR preview">
        <div className="canvas-stage">
          {rendered
            ? <div className="qr-paper" dangerouslySetInnerHTML={{ __html: rendered.svg }}/>
            : <div className="scanner-result render-error" role="alert" aria-label="QR render error"><strong>QR cannot be rendered</strong><p>{renderState.error}</p><p className="help">Shorten the payload or reduce encoded data before exporting.</p></div>}
        </div>
        <div className="canvas-meta">
          <small>{rendered ? `Version ${Math.floor((rendered.matrixSize - 17) / 4)} · ${rendered.matrixSize}×${rendered.matrixSize} modules` : 'Encoding unavailable for this payload'}</small>
          <span className="score-pill" aria-label="Decode status" aria-live="polite">{!rendered ? 'Encode failed' : decoded === null ? 'Checking…' : decoded ? '✓ Decodes' : 'Decode failed'}</span>
        </div>
        {rendered ? <MockupPreview mockup={mockup} setMockup={setMockup} svg={rendered.svg}/> : null}
      </section>
      <aside className="panel"><div className="panel-scroll">
        <DesignPanel />
        <div className="divider"/>
        <Safety score={safety.score} grade={safety.grade} issues={safety.issues} simulations={simulations} simulating={simulating} onSimulate={() => void runSimulations()} onAutoFix={autoFix}/>
        <div className="divider"/>
        {printPlan ? <PrintAssistant dpi={dpi} setDpi={setDpi} plan={printPlan}/> : null}
        <div className="divider"/>
        <ExportPanel format={format} setFormat={setFormat} width={width} setWidth={setWidth} transparent={transparent} setTransparent={setTransparent} projectName={projectName} setProjectName={setProjectName} tags={projectTags} setTags={setProjectTags} onExport={() => void doExport()} onSave={() => void saveCurrent()} onShare={() => void copyDesignLink()} onExportJson={exportDesignJson} onImport={() => importRef.current?.click()} status={status} canExport={rendered !== null}/>
        <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importDesign(event.target.files?.[0])}/>
        {activeProject ? <><div className="divider"/><HistoryPanel currentRevision={activeProject.revision} history={history} onRestore={restoreRevision}/></> : null}
      </div></aside>
    </div>
  </section>;
}

function Safety(props: Readonly<{
  score: number;
  grade: string;
  issues: readonly { readonly code: string; readonly severity: string; readonly message: string; readonly fix: string }[];
  simulations: readonly SafetySimulationResult[] | undefined;
  simulating: boolean;
  onSimulate: () => void;
  onAutoFix: () => void;
}>) {
  return <section aria-labelledby="safety-title">
    <div className="panel-header"><div><h2 id="safety-title">Scan Safety v2</h2><p>Heuristics + real decode + degradation tests.</p></div></div>
    <div className="safety-score"><div className="score-ring" style={{ '--score': props.score } as React.CSSProperties}><strong>{props.score}</strong></div><div><strong>{props.grade}</strong><p className="help">A failing real decode or multiple stress failures carry the strongest penalties.</p></div></div>
    <div className="style-grid"><button className="button" type="button" disabled={props.simulating} onClick={props.onSimulate}><ShieldCheck size={15}/>{props.simulating ? 'Testing…' : 'Run stress tests'}</button><button className="button accent" type="button" disabled={props.issues.length === 0} onClick={props.onAutoFix}><WandSparkles size={15}/>Auto Fix</button></div>
    {props.simulations ? <div className="simulation-grid" aria-label="Stress test results">{props.simulations.map((result) => <span className={`simulation-chip ${result.decoded ? 'pass' : 'fail'}`} key={result.kind}>{result.decoded ? '✓' : '×'} {result.label}</span>)}</div> : <p className="help">Stress tests simulate blur, down/up-scaling, rotation and reduced contrast in this browser.</p>}
    {props.issues.length === 0 ? <div className="success-box">No safety issues detected at this output size.</div> : <div className="issue-list">{props.issues.map((issue) => <div className={`issue ${issue.severity}`} key={issue.code}><strong>{issue.message}</strong><span>{issue.fix}</span></div>)}</div>}
  </section>;
}

function PrintAssistant(props: Readonly<{ dpi: number; setDpi: (dpi: number) => void; plan: ReturnType<typeof calculatePrintPlan> }>) {
  const plan = props.plan;
  return <section aria-labelledby="print-title">
    <div className="panel-header"><div><h2 id="print-title">Print Safety Assistant</h2><p>Printer-aware module sizing with a four-module quiet zone floor.</p></div></div>
    <div className="field"><label htmlFor="print-dpi">Printer resolution</label><select id="print-dpi" className="select" value={props.dpi} onChange={(event) => props.setDpi(Number(event.target.value))}>{[200,300,360,600,1200].map((value) => <option key={value} value={value}>{value} DPI</option>)}</select></div>
    <div className="metric-grid">
      <div><span>5-dot module</span><strong>{plan.moduleMm.toFixed(2)} mm</strong></div>
      <div><span>Suggested min width</span><strong>{plan.minimumWidthMm.toFixed(1)} mm</strong></div>
      <div><span>Current print width</span><strong>{plan.currentWidthMm.toFixed(1)} mm</strong></div>
      <div><span>Current module</span><strong>{plan.currentModuleMm.toFixed(2)} mm</strong></div>
    </div>
    <div className={plan.meetsModuleTarget ? 'success-box' : 'issue warning'}>{plan.meetsModuleTarget ? 'Current export meets the selected 5-dot/module print target.' : 'Increase pixel export size or reduce print DPI/physical compression for this printer target.'}</div>
    <p className="help">Phone scan-distance planning estimate: about {Math.round(plan.recommendedScanDistanceCm)} cm. Real distance depends on camera, lighting, print material and QR density.</p>
  </section>;
}

function MockupPreview(props: Readonly<{ mockup: Mockup; setMockup: (mockup: Mockup) => void; svg: string }>) {
  const previewSvg = props.svg.replaceAll('moduqr-', 'moduqr-mockup-');
  return <section className="mockup-section" aria-labelledby="mockup-title">
    <div className="mockup-heading"><div><strong id="mockup-title">Mockup Preview</strong><span>Visual context only; export remains the original QR.</span></div><select className="select compact-select" aria-label="Mockup type" value={props.mockup} onChange={(event) => props.setMockup(event.target.value as Mockup)}><option value="card">Business card</option><option value="poster">Poster</option><option value="phone">Phone screen</option><option value="package">Package</option></select></div>
    <div className={`mockup-stage mockup-${props.mockup}`}><div className="mockup-copy"><strong>ModuQR</strong><span>Scan to continue</span></div><div className="mockup-qr" dangerouslySetInnerHTML={{ __html: previewSvg }}/></div>
  </section>;
}

function HistoryPanel(props: Readonly<{ currentRevision: number; history: readonly ProjectRevision[]; onRestore: (revision: ProjectRevision) => void }>) {
  return <section aria-labelledby="history-title"><div className="panel-header"><div><h2 id="history-title"><History size={17}/> Design history</h2><p>Latest 40 local saved revisions.</p></div></div>{props.history.length === 0 ? <p className="help">Save the project to create revision history.</p> : <div className="history-list">{props.history.map((entry) => <div className="history-row" key={`${entry.projectId}-${entry.revision}`}><div><strong>Revision {entry.revision}{entry.revision === props.currentRevision ? ' · current' : ''}</strong><span>{new Date(entry.savedAt).toLocaleString()}</span></div><button className="button ghost compact" type="button" disabled={entry.revision === props.currentRevision} onClick={() => props.onRestore(entry)}>Restore</button></div>)}</div>}</section>;
}

function ExportPanel(props: Readonly<{
  format: ExportFormat;
  setFormat: (value: ExportFormat) => void;
  width: number;
  setWidth: (value: number) => void;
  transparent: boolean;
  setTransparent: (value: boolean) => void;
  projectName: string;
  setProjectName: (value: string) => void;
  tags: readonly string[];
  setTags: (value: readonly string[]) => void;
  onExport: () => void;
  onSave: () => void;
  onShare: () => void;
  onExportJson: () => void;
  onImport: () => void;
  status: string;
  canExport: boolean;
}>) {
  return <section aria-labelledby="export-title"><div className="panel-header"><div><h2 id="export-title">Export & project</h2><p>Every direct download is preflight-decoded.</p></div></div><div className="form-stack">
    <div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" className="input" value={props.projectName} onChange={(event) => props.setProjectName(event.target.value)} maxLength={120}/></div>
    <div className="field"><label htmlFor="project-tags">Project tags</label><input id="project-tags" className="input" value={props.tags.join(', ')} onChange={(event) => props.setTags(parseTags(event.target.value))} placeholder="campaign, print, client" maxLength={240}/><span className="help">Comma-separated. Stored only in local project data.</span></div>
    <div className="field"><label htmlFor="format">Format</label><select id="format" className="select" value={props.format} onChange={(event) => props.setFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="svg">SVG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select></div>
    <div className="field"><label htmlFor="resolution">Resolution</label><input id="resolution" className="input" type="number" inputMode="numeric" min={256} max={8192} step={1} value={props.width} onChange={(event) => props.setWidth(Math.max(256, Math.min(8192, Number(event.target.value) || 256)))}/><div className="style-grid" aria-label="Export resolution presets">{[512,1024,2048,4096].map((value) => <button type="button" className="button ghost" key={value} aria-pressed={props.width === value} onClick={() => props.setWidth(value)}>{value}px</button>)}</div></div>
    <label className="field-label"><input type="checkbox" checked={props.transparent} disabled={props.format === 'jpeg' || props.format === 'pdf'} onChange={(event) => props.setTransparent(event.target.checked)}/> Transparent background</label>
    <button type="button" className="button accent" onClick={props.onExport} disabled={!props.canExport}><Download size={16}/> Verify & download</button>
    <button type="button" className="button" onClick={props.onSave}><Save size={16}/> Save locally</button>
    <div className="style-grid"><button type="button" className="button ghost" onClick={props.onShare}><Copy size={15}/> Design link</button><button type="button" className="button ghost" onClick={props.onExportJson}><FileDown size={15}/> JSON</button><button type="button" className="button ghost" onClick={props.onImport}><Upload size={15}/> Import</button></div>
    {props.status ? <div className="help" role="status" aria-live="polite">{props.status}</div> : null}
  </div></section>;
}

function parseTags(value: string): readonly string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim().slice(0, 32)).filter(Boolean))].slice(0, 12);
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'moduqr';
}
