'use client';

import { PRESET_CATEGORIES, PRESETS } from '@moduqr/presets';
import type {
  FinderPosition,
  FinderShape,
  FrameStyle,
  GradientDefinition,
  ModuleShape,
  QRRegion,
  QRStyle,
} from '@moduqr/shared';
import { sanitizeLogoFile } from '@/lib/sanitize-logo';
import { useStudioStore } from '@/lib/studio-store';
import { Heart, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
const qrRegions: readonly { readonly value: QRRegion; readonly label: string }[] = [
  { value: 'data', label: 'Data modules' },
  { value: 'timing', label: 'Timing pattern' },
  { value: 'alignment', label: 'Alignment patterns' },
];
const FAVORITES_KEY = 'moduqr-preset-favorites-v1';

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
  const [presetQuery, setPresetQuery] = useState('');
  const [presetCategory, setPresetCategory] = useState<string>('All');
  const [presetFavorites, setPresetFavorites] = useState<readonly string[]>([]);

  const patchLogo = (patch: Partial<QRStyle['logo']>) => patchStyle({ logo: { ...style.logo, ...patch } });
  const patchFrame = (patch: Partial<QRStyle['frame']>) => patchStyle({ frame: { ...style.frame, ...patch } });
  const patchRegion = (region: QRRegion, patch: Partial<QRStyle['regionStyles'][QRRegion]>) => patchStyle({
    regionStyles: { ...style.regionStyles, [region]: { ...style.regionStyles[region], ...patch } },
  });
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

  useEffect(() => {
    let active = true;
    const loadFavorites = () => {
      if (!active) return;
      try {
        const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? '[]') as unknown;
        setPresetFavorites(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []);
      } catch {
        setPresetFavorites([]);
      }
    };
    const task = window.setTimeout(loadFavorites, 0);
    return () => {
      active = false;
      window.clearTimeout(task);
    };
  }, []);

  const visiblePresets = useMemo(() => {
    const query = presetQuery.trim().toLocaleLowerCase();
    return PRESETS.filter((preset) => {
      const categoryMatch = presetCategory === 'All' || preset.category === presetCategory || (presetCategory === 'Favorites' && presetFavorites.includes(preset.id));
      const queryMatch = !query || `${preset.name} ${preset.category} ${preset.tags.join(' ')}`.toLocaleLowerCase().includes(query);
      return categoryMatch && queryMatch;
    });
  }, [presetCategory, presetFavorites, presetQuery]);

  const togglePresetFavorite = (id: string) => {
    const next = presetFavorites.includes(id) ? presetFavorites.filter((value) => value !== id) : [...presetFavorites, id];
    setPresetFavorites(next);
    try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* local favorites are best effort */ }
  };

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

      <div className="divider"/>
      <div className="field"><span className="field-label">Per-region styling</span><span className="help">Keep timing/alignment patterns conservative for scan reliability. Null values inherit the global module style.</span></div>
      <div className="region-style-list">{qrRegions.map((region) => { const configured = style.regionStyles[region.value]; return <div className="finder-editor-card" key={region.value}><strong>{region.label}</strong><div className="field"><label htmlFor={`region-${region.value}-shape`}>Shape</label><select id={`region-${region.value}-shape`} className="select" value={configured.shape ?? ''} onChange={(event) => patchRegion(region.value, { shape: event.target.value === '' ? null : event.target.value as ModuleShape })}><option value="">Global ({style.moduleShape})</option>{moduleShapes.map((shape) => <option value={shape.value} key={shape.value}>{shape.label}</option>)}</select></div><OptionalColorField label={`${region.label} color`} value={configured.color} fallback={style.foreground} onChange={(color) => patchRegion(region.value, { color })}/></div>; })}</div>

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
    {tab === 'presets' ? <div className="form-stack" role="tabpanel" id="design-panel-presets" aria-labelledby="design-tab-presets"><div className="preset-toolbar"><div className="field preset-search"><label htmlFor="preset-search">Find preset</label><div className="input-with-icon"><Search size={14}/><input id="preset-search" className="input" value={presetQuery} onChange={(event) => setPresetQuery(event.target.value)} placeholder="Search 60 presets"/></div></div><div className="field"><label htmlFor="preset-category">Category</label><select id="preset-category" className="select" value={presetCategory} onChange={(event) => setPresetCategory(event.target.value)}><option value="All">All</option><option value="Favorites">Favorites</option>{PRESET_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div></div><div className="preset-list">{visiblePresets.map((preset) => <div className="preset-card-wrap" key={preset.id}><button type="button" className="preset-card" aria-pressed={presetId === preset.id} onClick={() => setStyle(preset.style, preset.id)}><span className="preset-swatch" style={{ background: preset.style.background, color: preset.style.foreground }}><i/><i/><i/><i/></span><span><strong>{preset.name}</strong><small>{preset.category}</small></span></button><button className="icon-button preset-favorite" type="button" aria-label={presetFavorites.includes(preset.id) ? `Remove ${preset.name} from favorites` : `Add ${preset.name} to favorites`} onClick={() => togglePresetFavorite(preset.id)}><Heart size={14} fill={presetFavorites.includes(preset.id) ? 'currentColor' : 'none'}/></button></div>)}</div>{visiblePresets.length === 0 ? <p className="help">No presets match this filter.</p> : null}</div> : null}
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
