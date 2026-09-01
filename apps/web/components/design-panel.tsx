'use client';

import { PRESETS } from '@moduqr/presets';
import type { FinderShape, FrameStyle, ModuleShape, QRStyle } from '@moduqr/shared';
import { sanitizeLogoFile } from '@/lib/sanitize-logo';
import { useStudioStore } from '@/lib/studio-store';
import { useState } from 'react';

const moduleShapes: readonly { readonly value: ModuleShape; readonly label: string }[] = [
  { value: 'square', label: 'Square' }, { value: 'rounded', label: 'Rounded' }, { value: 'extra-rounded', label: 'Extra round' }, { value: 'dots', label: 'Dots' },
  { value: 'circle', label: 'Circle' }, { value: 'diamond', label: 'Diamond' }, { value: 'soft-square', label: 'Soft square' }, { value: 'pixel', label: 'Pixel' },
];
const finderShapes: readonly FinderShape[] = ['square', 'rounded', 'circle'];
const frameStyles: readonly FrameStyle[] = ['none', 'minimal', 'rounded', 'badge', 'label', 'sticker'];

type Tab = 'style' | 'eyes' | 'logo' | 'frame' | 'presets';

export function DesignPanel() {
  const style = useStudioStore((state) => state.style);
  const setStyle = useStudioStore((state) => state.setStyle);
  const patchStyle = useStudioStore((state) => state.patchStyle);
  const presetId = useStudioStore((state) => state.presetId);
  const [tab, setTab] = useState<Tab>('style');
  const [logoError, setLogoError] = useState('');

  const patchLogo = (patch: Partial<QRStyle['logo']>) => patchStyle({ logo: { ...style.logo, ...patch } });
  const patchFrame = (patch: Partial<QRStyle['frame']>) => patchStyle({ frame: { ...style.frame, ...patch } });
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

  return <div>
    <div className="panel-header"><div><h2>Design</h2><p>Style it without losing reliability.</p></div></div>
    <div className="tabs" role="tablist" aria-label="Design sections">
      {(['style', 'eyes', 'logo', 'frame', 'presets'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}
    </div>
    {tab === 'style' ? <div className="form-stack">
      <span className="field-label">Modules</span><div className="style-grid">{moduleShapes.map((shape) => <button className="style-choice" type="button" key={shape.value} aria-pressed={style.moduleShape === shape.value} onClick={() => patchStyle({ moduleShape: shape.value })}>{shape.label}</button>)}</div>
      <ColorField label="Foreground" value={style.foreground} onChange={(foreground) => patchStyle({ foreground, gradient: null })}/>
      <ColorField label="Background" value={style.background} onChange={(background) => patchStyle({ background })}/>
      <label className="field-label"><input type="checkbox" checked={Boolean(style.gradient)} onChange={(event) => patchStyle({ gradient: event.target.checked ? { type: 'linear', angle: 45, stops: [{ offset: 0, color: style.foreground }, { offset: 1, color: '#5b4cf0' }] } : null })}/> Use gradient</label>
      {style.gradient ? <><ColorField label="Gradient end" value={style.gradient.stops[1]?.color ?? '#5b4cf0'} onChange={(color) => patchStyle({ gradient: style.gradient ? { ...style.gradient, stops: [style.gradient.stops[0] ?? { offset: 0, color: style.foreground }, { offset: 1, color }] } : null })}/><Range label="Angle" value={style.gradient.angle} min={0} max={360} step={1} onChange={(angle) => patchStyle({ gradient: style.gradient ? { ...style.gradient, angle } : null })}/></> : null}
      <Range label="Quiet zone" value={style.quietZone} min={4} max={12} step={1} onChange={(quietZone) => patchStyle({ quietZone })}/>
      <Range label="Module gap" value={style.moduleGap} min={0} max={0.25} step={0.01} onChange={(moduleGap) => patchStyle({ moduleGap })}/>
      <div className="field"><label htmlFor="ecc">Error correction</label><select id="ecc" className="select" value={style.errorCorrection} onChange={(event) => patchStyle({ errorCorrection: event.target.value as QRStyle['errorCorrection'] })}><option value="L">Low</option><option value="M">Medium</option><option value="Q">Quartile</option><option value="H">High</option></select></div>
    </div> : null}
    {tab === 'eyes' ? <div className="form-stack"><span className="field-label">Outer finder</span><div className="style-grid">{finderShapes.map((shape) => <button className="style-choice" type="button" key={shape} aria-pressed={style.finderOuterShape === shape} onClick={() => patchStyle({ finderOuterShape: shape })}>{shape}</button>)}</div><span className="field-label">Inner finder</span><div className="style-grid">{finderShapes.map((shape) => <button className="style-choice" type="button" key={shape} aria-pressed={style.finderInnerShape === shape} onClick={() => patchStyle({ finderInnerShape: shape })}>{shape}</button>)}</div></div> : null}
    {tab === 'logo' ? <div className="form-stack"><div className="field"><label htmlFor="logo">Logo</label><input id="logo" className="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void onLogo(event.target.files?.[0])}/><span className="help">Processed locally. SVG is sanitized before use.</span>{logoError ? <span className="error">{logoError}</span> : null}</div>{style.logo.dataUrl ? <><Range label="Logo size" value={style.logo.size} min={0.1} max={0.26} step={0.01} onChange={(size) => patchLogo({ size })}/><Range label="Padding" value={style.logo.padding} min={0} max={14} step={1} onChange={(padding) => patchLogo({ padding })}/><ColorField label="Logo background" value={style.logo.background} onChange={(background) => patchLogo({ background })}/><button type="button" className="button danger" onClick={() => patchLogo({ dataUrl: null, mimeType: null })}>Remove logo</button></> : null}</div> : null}
    {tab === 'frame' ? <div className="form-stack"><span className="field-label">Frame style</span><div className="style-grid">{frameStyles.map((frame) => <button className="style-choice" type="button" key={frame} aria-pressed={style.frame.style === frame} onClick={() => patchFrame({ style: frame })}>{frame}</button>)}</div>{style.frame.style !== 'none' ? <><div className="field"><label htmlFor="frame-text">CTA text</label><input id="frame-text" className="input" value={style.frame.text} maxLength={80} onChange={(event) => patchFrame({ text: event.target.value })}/></div><Range label="Text size" value={style.frame.fontSize} min={12} max={32} step={1} onChange={(fontSize) => patchFrame({ fontSize })}/></> : null}</div> : null}
    {tab === 'presets' ? <div className="preset-list">{PRESETS.map((preset) => <button type="button" className="preset-card" key={preset.id} aria-pressed={presetId === preset.id} onClick={() => setStyle(preset.style, preset.id)}><span className="preset-swatch" style={{ background: preset.style.background, color: preset.style.foreground }}><i/><i/><i/><i/></span><span>{preset.name}</span></button>)}</div> : null}
  </div>;
}

function ColorField({ label, value, onChange }: Readonly<{ label: string; value: string; onChange: (value: string) => void }>) {
  return <div className="field"><span className="field-label">{label}</span><div className="color-row"><input aria-label={`${label} color`} className="color" type="color" value={value} onChange={(event) => onChange(event.target.value)}/><input className="input" aria-label={`${label} hex value`} value={value} onChange={(event) => onChange(event.target.value)}/></div></div>;
}
function Range({ label, value, min, max, step, onChange }: Readonly<{ label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }>) {
  return <div className="field"><span className="field-label">{label}</span><div className="range-row"><input className="range" type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))}/><span className="help">{value}</span></div></div>;
}
