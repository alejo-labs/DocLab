import type { ReactNode } from 'react';
import { Minus, Plus, ZoomIn } from 'lucide-react';

const SWATCHES = ['#14161b', '#ffffff', '#f2683c', '#0fb5a6', '#2f6df2', '#e4b300', '#d92d20', '#7c3aed'];

/** Selector de color: swatches + selector libre. Reutilizable en cualquier herramienta. */
export function ColorControl({ value, onChange, allowNull = false }: { value: string | null; onChange: (c: string | null) => void; allowNull?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowNull && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Sin color"
          className={`grid size-6 place-items-center rounded-full border text-[10px] ${value === null ? 'border-ink ring-2 ring-ink/20' : 'border-line'}`}
        >
          ∅
        </button>
      )}
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={`size-6 rounded-full border ${value?.toLowerCase() === c ? 'border-ink ring-2 ring-ink/20' : 'border-line'}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label className="relative size-6 cursor-pointer overflow-hidden rounded-full border border-line" title="Color personalizado">
        <span className="absolute inset-0" style={{ background: 'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)' }} />
        <input type="color" value={value && value.startsWith('#') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

/** Slider con vista previa visual del grosor (un punto del tamaño real). */
export function BrushSlider({ value, min, max, onChange, color = '#14161b', label = 'Grosor' }: { value: number; min: number; max: number; onChange: (v: number) => void; color?: string; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-graphite">
        <span>{label}</span>
        <span className="font-mono">{value}px</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-signal" />
        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-paper" title="Vista previa">
          <span className="rounded-full" style={{ width: Math.min(value, 22), height: Math.min(value, 22), backgroundColor: color }} />
        </span>
      </div>
    </div>
  );
}

/** Slider genérico con valor y unidad. */
export function LabeledSlider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-graphite">
      <span className="flex justify-between">
        {label} <span className="font-mono">{Math.round(value)}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-signal" />
    </label>
  );
}

export interface SegOption<V extends string> {
  value: V;
  label?: string;
  icon?: ReactNode;
  title?: string;
}

/** Control segmentado (radio horizontal) reutilizable. */
export function Segmented<V extends string>({ options, value, onChange }: { options: SegOption<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="flex gap-1 rounded-md border border-line bg-paper p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          title={o.title ?? o.label}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors ${value === o.value ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Botón de alternancia (negrita, cursiva…). */
export function ToggleIcon({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`grid size-8 place-items-center rounded-md border text-sm transition-colors ${active ? 'border-ink bg-ink text-paper' : 'border-line text-graphite hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

/** Controles de zoom reutilizables. */
export function ZoomControls({ zoom, onZoom, onFit }: { zoom: number; onZoom: (z: number) => void; onFit: () => void }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="flex items-center gap-1 rounded-md border border-line bg-paper p-0.5">
      <button type="button" onClick={() => onZoom(Math.max(0.3, Math.round((zoom - 0.1) * 10) / 10))} title="Alejar (-10%)" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink">
        <Minus className="size-4" />
      </button>
      <span className="w-12 text-center font-mono text-xs text-ink font-medium">{pct}%</span>
      <button type="button" onClick={() => onZoom(Math.min(3, Math.round((zoom + 0.1) * 10) / 10))} title="Acercar (+10%)" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink">
        <Plus className="size-4" />
      </button>
      <button type="button" onClick={onFit} title="Restablecer (100%)" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink">
        <ZoomIn className="size-4" />
      </button>
    </div>
  );
}
