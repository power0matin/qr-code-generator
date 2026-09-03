'use client';

import { PRESETS } from '@moduqr/presets';
import type {
  FinderPosition,
  FinderShape,
  FrameStyle,
  GradientDefinition,
  ModuleShape,
  QRStyle,
} from '@moduqr/shared';
import { sanitizeLogoFile } from '@/lib/sanitize-logo';
import { useStudioStore } from '@/lib/studio-store';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

const moduleShapes: readonly { readonly value: ModuleShape; readonly label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'extra-rounded', label: 'Extra round' },
  { value: 'dots', label: 'Dots' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'soft-square', label: 'Soft square' },
  { value: 'pixel', label: 'Pixel' },
  { value: 'connected', label: 'Connected' },
  { value: 'fluid', label: 'Fluid' },
];
const finderShapes: readonly FinderShape[] = ['square', 'rounded', 'circle'];
const finderPositions: readonly { readonly value: FinderPosition; readonly label: string }[] = [
  { value: 'topLeft', label: 'Top left' },
  { value: 'topRight', label: 'Top right' },
  { value: 'bottomLeft', label: 'Bottom left' },
];
const frameStyles: readonly FrameStyle[] = ['none', 'minimal', 'rounded', 'badge', 'label', 'sticker'];

type Tab = 'style' | 'eyes' | 'logo' | 'frame' | 'presets';
const designTabs: readonly Tab[] = ['style', 'eyes', 'logo', 'frame', 'presets'];

export function DesignPanel() {
  const style = useStudioStore((state) => state.style);
  const setStyle = useStudioStore((state) => state.setStyle);
  const patchStyle = useStudioStore((state) => state.patchStyle);
  const presetId = useStudioStore((state) => state.presetId);
  const [tab, setTab] = useState<Tab>('style');
  const [finderPosition, setFinderPosition] = useState<FinderPosition>('topLeft');
  const [logoError, setLogoError] = useState('');

  const patchLogo = (patch: Partial<QRStyle['logo']>) => patchStyle({ logo: { ...style.logo, ...patch } });
  const patchFrame = (patch: Partial<QRStyle['frame']>) => patchStyle({ frame: { ...style.frame, ...patch } });
  const patchFinder = (position: FinderPosition, patch: Partial<QRStyle['finderOverrides'][FinderPosition]>) => {
    patchStyle({
      finderOverrides: {
        ...style.finderOverrides,
        [position]: { ...style.finderOverrides[position], ...patch },
      },
    });
  };
  const resetFinder = (position: FinderPosition) => patchFinder(position, { outerShape: null, innerShape: null, outerColor: null, innerColor: null });

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const safe = await sanitizeLogoFile(file);
      setStyle({ ...style, errorCorrection: 'H', logo: { ...style.logo, dataUrl: safe.dataUrl, mimeType: safe.mimeType } });
      setLogoError('');
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'Logo could not be loaded.');
    }
  };

  const currentFinder = style.finderOverrides[finderPosition];

  return <div>
    <div className="panel-header"><div><h2>Design</h2><p>Style it without losing reliability.</p></div></div>
    <div className="tabs" role="tablist" aria-label="Design sections">
      {designTabs.map((item, index) => <button
        id={`design-tab-${item}`}
        key={item}
        type="button"
        role="tab"
        aria-selected={tab === item}
        aria-controls={`design-panel-${item}`}
        tabIndex={tab === item ? 0 : -1}
        onClick={() => setTab(item)}
        onKeyDown={(event) => {
          const key = event.key;
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
          event.preventDefault();
          const nextIndex = key === 'Home' ? 0 : key === 'End' ? designTabs.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + designTabs.length) % designTabs.length;
          const next = designTabs[nextIndex];
          if (!next) return;
          setTab(next);
          window.requestAnimationFrame(() => document.getElementById(`design-tab-${next}`)?.focus());
        }}
      >{item}</button>)}
    </div>

    {tab === 'style' ? <div className="form-stack" role="tabpanel" id="design-panel-style" aria-labelledby="design-tab-style">
      <div className="field">
        <span className="field-label">Modules</span>
        <span className="help">Connected and Fluid use neighbour-aware geometry rather than isolated module rounding.</span>
      </div>
      <div className="style-grid">{moduleShapes.map((shape) => <button className="style-choice" type="button" key={shape.value} aria-pressed={style.moduleShape === shape.value} onClick={() => patchStyle({ moduleShape: shape.value })}>{shape.label}</button>)}</div>

      <ColorField label="Foreground" value={style.foreground} onChange={(foreground) => patchStyle({ foreground, gradient: null })}/>
      <GradientToggle
        label="Module gradient"
        enabled={Boolean(style.gradient)}
        onToggle={(enabled) => patchStyle({ gradient: enabled ? defaultModuleGradient(style.foreground) : null })}
      />
      {style.gradient ? <GradientEditor label="Module gradient" gradient={style.gradient} onChange={(gradient) => patchStyle({ gradient })}/> : null}

      <ColorField label="Background" value={style.background} onChange={(background) => patchStyle({ background, backgroundGradient: null })}/>
      <GradientToggle
        label="Background gradient"
        enabled={Boolean(style.backgroundGradient)}
        onToggle={(enabled) => patchStyle({ backgroundGradient: enabled ? defaultBackgroundGradient(style.background) : null })}
      />
      {style.backgroundGradient ? <GradientEditor label="Background gradient" gradient={style.backgroundGradient} onChange={(backgroundGradient) => patchStyle({ backgroundGradient })}/> : null}

      <Range label="Quiet zone" value={style.quietZone} min={4} max={16} step={1} onChange={(quietZone) => patchStyle({ quietZone })}/>
      <Range label="Module gap" value={style.moduleGap} min={0} max={0.35} step={0.01} onChange={(moduleGap) => patchStyle({ moduleGap })}/>
      <div className="field"><label htmlFor="ecc">Error correction</label><select id="ecc" className="select" value={style.errorCorrection} onChange={(event) => patchStyle({ errorCorrection: event.target.value as QRStyle['errorCorrection'] })}><option value="L">Low</option><option value="M">Medium</option><option value="Q">Quartile</option><option value="H">High</option></select></div>
    </div> : null}

    {tab === 'eyes' ? <div className="form-stack" role="tabpanel" id="design-panel-eyes" aria-labelledby="design-tab-eyes">
      <div className="field"><span className="field-label">Global finder style</span><span className="help">These values apply unless a finder has an individual override.</span></div>
      <span className="field-label">Outer finder</span>
      <div className="style-grid">{finderShapes.map((shape) => <button className="style-choice" type="button" key={shape} aria-pressed={style.finderOuterShape === shape} onClick={() => patchStyle({ finderOuterShape: shape })}>{shape}</button>)}</div>
      <span className="field-label">Inner finder</span>
      <div className="style-grid">{finderShapes.map((shape) => <button className="style-choice" type="button" key={shape} aria-pressed={style.finderInnerShape === shape} onClick={() => patchStyle({ finderInnerShape: shape })}>{shape}</button>)}</div>

      <div className="divider"/>
      <div className="field"><span className="field-label">Independent finder customization</span><span className="help">Override shape and color for each of the three finder patterns without changing the others.</span></div>
      <div className="finder-position-grid" role="group" aria-label="Finder position">
        {finderPositions.map((position) => <button type="button" className="style-choice" key={position.value} aria-pressed={finderPosition === position.value} onClick={() => setFinderPosition(position.value)}>{position.label}</button>)}
      </div>
      <div className="finder-editor-card">
        <div className="finder-editor-heading"><div><strong>{finderPositions.find((position) => position.value === finderPosition)?.label}</strong><span>Overrides inherit global values when set to “Global”.</span></div><button type="button" className="button ghost compact" onClick={() => resetFinder(finderPosition)}><RotateCcw size={14}/> Reset</button></div>
        <div className="field"><label htmlFor="finder-outer-override">Outer shape</label><select id="finder-outer-override" className="select" value={currentFinder.outerShape ?? ''} onChange={(event) => patchFinder(finderPosition, { outerShape: event.target.value === '' ? null : event.target.value as FinderShape })}><option value="">Global ({style.finderOuterShape})</option>{finderShapes.map((shape) => <option value={shape} key={shape}>{shape}</option>)}</select></div>
        <div className="field"><label htmlFor="finder-inner-override">Inner shape</label><select id="finder-inner-override" className="select" value={currentFinder.innerShape ?? ''} onChange={(event) => patchFinder(finderPosition, { innerShape: event.target.value === '' ? null : event.target.value as FinderShape })}><option value="">Global ({style.finderInnerShape})</option>{finderShapes.map((shape) => <option value={shape} key={shape}>{shape}</option>)}</select></div>
        <OptionalColorField label="Outer color" value={currentFinder.outerColor} fallback={style.foreground} onChange={(outerColor) => patchFinder(finderPosition, { outerColor })}/>
        <OptionalColorField label="Inner color" value={currentFinder.innerColor} fallback={style.foreground} onChange={(innerColor) => patchFinder(finderPosition, { innerColor })}/>
      </div>
    </div> : null}

    {tab === 'logo' ? <div className="form-stack" role="tabpanel" id="design-panel-logo" aria-labelledby="design-tab-logo"><div className="field"><label htmlFor="logo">Logo</label><input id="logo" className="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void onLogo(event.target.files?.[0])}/><span className="help">Processed locally. SVG is sanitized before use.</span>{logoError ? <span className="error">{logoError}</span> : null}</div>{style.logo.dataUrl ? <><Range label="Logo size" value={style.logo.size} min={0.1} max={0.26} step={0.01} onChange={(size) => patchLogo({ size })}/><Range label="Padding" value={style.logo.padding} min={0} max={20} step={1} onChange={(padding) => patchLogo({ padding })}/><ColorField label="Logo background" value={style.logo.background} onChange={(background) => patchLogo({ background })}/><button type="button" className="button danger" onClick={() => patchLogo({ dataUrl: null, mimeType: null })}>Remove logo</button></> : null}</div> : null}
    {tab === 'frame' ? <div className="form-stack" role="tabpanel" id="design-panel-frame" aria-labelledby="design-tab-frame"><span className="field-label">Frame style</span><div className="style-grid">{frameStyles.map((frame) => <button className="style-choice" type="button" key={frame} aria-pressed={style.frame.style === frame} onClick={() => patchFrame({ style: frame })}>{frame}</button>)}</div>{style.frame.style !== 'none' ? <><div className="field"><label htmlFor="frame-text">CTA text</label><input id="frame-text" className="input" value={style.frame.text} maxLength={80} onChange={(event) => patchFrame({ text: event.target.value })}/></div><Range label="Text size" value={style.frame.fontSize} min={12} max={40} step={1} onChange={(fontSize) => patchFrame({ fontSize })}/></> : null}</div> : null}
    {tab === 'presets' ? <div className="preset-list" role="tabpanel" id="design-panel-presets" aria-labelledby="design-tab-presets">{PRESETS.map((preset) => <button type="button" className="preset-card" key={preset.id} aria-pressed={presetId === preset.id} onClick={() => setStyle(preset.style, preset.id)}><span className="preset-swatch" style={{ background: preset.style.background, color: preset.style.foreground }}><i/><i/><i/><i/></span><span>{preset.name}</span></button>)}</div> : null}
  </div>;
}

function defaultModuleGradient(color: string): GradientDefinition {
  return {
    type: 'linear',
    angle: 45,
    stops: [
      { offset: 0, color },
      { offset: 0.52, color: '#312e81' },
      { offset: 1, color: '#5b21b6' },
    ],
  };
}

function defaultBackgroundGradient(color: string): GradientDefinition {
  return {
    type: 'radial',
    angle: 0,
    stops: [
      { offset: 0, color: '#f5f3ff' },
      { offset: 1, color },
    ],
  };
}

function GradientToggle({ label, enabled, onToggle }: Readonly<{ label: string; enabled: boolean; onToggle: (enabled: boolean) => void }>) {
  return <label className="field-label gradient-toggle"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)}/><span>{label}</span></label>;
}

function GradientEditor({ label, gradient, onChange }: Readonly<{ label: string; gradient: GradientDefinition; onChange: (gradient: GradientDefinition) => void }>) {
  const setStop = (index: number, patch: Partial<GradientDefinition['stops'][number]>) => {
    const stops = gradient.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop);
    onChange({ ...gradient, stops });
  };
  const removeStop = (index: number) => {
    if (gradient.stops.length <= 2) return;
    onChange({ ...gradient, stops: gradient.stops.filter((_stop, stopIndex) => stopIndex !== index) });
  };
  const addStop = () => {
    if (gradient.stops.length >= 8) return;
    const sorted = [...gradient.stops].sort((a, b) => a.offset - b.offset);
    let insertAfter = 0;
    let largestGap = -1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      if (!current || !next) continue;
      const gap = next.offset - current.offset;
      if (gap > largestGap) { largestGap = gap; insertAfter = index; }
    }
    const left = sorted[insertAfter];
    const right = sorted[insertAfter + 1];
    if (!left || !right) return;
    const nextStop = { offset: (left.offset + right.offset) / 2, color: left.color };
    onChange({ ...gradient, stops: [...gradient.stops, nextStop].sort((a, b) => a.offset - b.offset) });
  };

  return <div className="gradient-editor">
    <div className="gradient-editor-head"><strong>{label}</strong><span>{gradient.stops.length} stops</span></div>
    <div className="gradient-preview" aria-hidden="true" style={{ background: gradientCss(gradient) }}/>
    <div className="field"><label htmlFor={`${slug(label)}-type`}>Gradient type</label><select id={`${slug(label)}-type`} className="select" value={gradient.type} onChange={(event) => onChange({ ...gradient, type: event.target.value as GradientDefinition['type'] })}><option value="linear">Linear</option><option value="radial">Radial</option></select></div>
    {gradient.type === 'linear' ? <Range label={`${label} angle`} value={gradient.angle} min={0} max={360} step={1} onChange={(angle) => onChange({ ...gradient, angle })}/> : null}
    <div className="gradient-stop-list">
      {gradient.stops.map((stop, index) => <div className="gradient-stop-row" key={`${index}-${stop.offset}`}>
        <input aria-label={`${label} stop ${index + 1} color`} className="color" type="color" value={stop.color} onChange={(event) => setStop(index, { color: event.target.value })}/>
        <div className="gradient-stop-position"><input aria-label={`${label} stop ${index + 1} position`} className="range" type="range" min={0} max={100} step={1} value={Math.round(stop.offset * 100)} onChange={(event) => setStop(index, { offset: Number(event.target.value) / 100 })}/><span>{Math.round(stop.offset * 100)}%</span></div>
        <button type="button" className="icon-button compact" aria-label={`Remove ${label} stop ${index + 1}`} disabled={gradient.stops.length <= 2} onClick={() => removeStop(index)}><Trash2 size={14}/></button>
      </div>)}
    </div>
    <button type="button" className="button ghost" disabled={gradient.stops.length >= 8} onClick={addStop}><Plus size={14}/> Add color stop</button>
  </div>;
}

function OptionalColorField({ label, value, fallback, onChange }: Readonly<{ label: string; value: string | null; fallback: string; onChange: (value: string | null) => void }>) {
  const enabled = value !== null;
  return <div className="field optional-color">
    <label className="field-label"><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked ? fallback : null)}/><span>Custom {label.toLowerCase()}</span></label>
    {enabled ? <ColorField label={label} value={value} onChange={onChange}/> : <span className="help">Using the global module paint.</span>}
  </div>;
}

function ColorField({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return <div className="field"><span className="field-label">{label}</span><div className="color-row"><input aria-label={`${label} color`} className="color" type="color" value={value} onChange={(event) => onChange(event.target.value)}/><input className="input" aria-label={`${label} hex value`} value={value} onChange={(event) => onChange(event.target.value)}/></div></div>;
}
function Range({ label, value, min, max, step, onChange }: Readonly<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }>) {
  return <div className="field"><span className="field-label">{label}</span><div className="range-row"><input className="range" type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))}/><span className="help">{value}</span></div></div>;
}

function gradientCss(gradient: GradientDefinition): string {
  const stops = [...gradient.stops].sort((a, b) => a.offset - b.offset).map((stop) => `${stop.color} ${Math.round(stop.offset * 100)}%`).join(', ');
  return gradient.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${gradient.angle}deg, ${stops})`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
