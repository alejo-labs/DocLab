import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import interact from 'interactjs';
import { useReportProcessing } from '../../lib/processing';
import { FormInput, MousePointer2, Type, Pilcrow, CheckSquare, CircleDot, ChevronDownSquare, Trash2, Copy, Wand2, Download, Eye, Pencil, PenLine, FileDown, List, LayoutPanelTop, Bold, Italic, AlignLeft, AlignCenter, AlignRight, ZoomIn, ZoomOut } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { SelectionFrame } from '../editor-kit/SelectionFrame';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension, downloadBytes } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { usePdfPages, type EditorPage } from '../../lib/pdf/usePdfPages';
import { readWidgetRects, type WidgetRect } from '../../lib/pdf/formLayout';
import { readFields, fillFields, addFields, type FormField, type FillValue, type NewField, type NewFieldKind, type FormFontFamily } from '../../lib/pdf/forms';
import { toast } from '../../lib/notify/toast';
import type { ToolEngineProps, ToolResult } from './types';

type Mode = 'fill' | 'design';
type DesignTool = 'select' | NewFieldKind;

interface Placed extends NewField {
  id: string;
}

const KIND_LABEL: Record<NewFieldKind, string> = { text: 'Texto', textarea: 'Área', checkbox: 'Casilla', radio: 'Opción', dropdown: 'Lista' };
const KIND_ICON: Record<NewFieldKind, typeof Type> = { text: Type, textarea: Pilcrow, checkbox: CheckSquare, radio: CircleDot, dropdown: ChevronDownSquare };

/** Familias estándar → CSS para una previsualización fiel. */
const FONT_CSS: Record<FormFontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 20) / 20));

/** Zoom instantáneo (multiplicador de layout, sin re-renderizar el PDF). */
function useZoom() {
  const [zoom, setZoom] = useState(1);
  const zin = () => setZoom((z) => clampZoom(z + 0.1));
  const zout = () => setZoom((z) => clampZoom(z - 0.1));
  const reset = () => setZoom(1);
  return { zoom, setZoom, zin, zout, reset };
}

interface ZoomBarProps { zoom: number; zin: () => void; zout: () => void; reset: () => void }
function ZoomBar({ zoom, zin, zout, reset }: ZoomBarProps) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-0.5">
      <button type="button" onClick={zout} disabled={zoom <= ZOOM_MIN} className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label="Alejar"><ZoomOut className="size-4" /></button>
      <button type="button" onClick={reset} className="min-w-12 rounded px-1 font-mono text-xs text-ink hover:bg-ink/5" title="Restablecer (Ctrl/Cmd+0)">{Math.round(zoom * 100)}%</button>
      <button type="button" onClick={zin} disabled={zoom >= ZOOM_MAX} className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label="Acercar"><ZoomIn className="size-4" /></button>
    </div>
  );
}

export function FormsTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, FillValue>>({});
  const [mode, setMode] = useState<Mode>('fill');
  const [flatten, setFlatten] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<'fill' | 'design'>('fill');
  useReportProcessing(busy);

  // Diseño
  const [designKind, setDesignKind] = useState<DesignTool>('text');
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [draft, setDraft] = useState<{ page: number; x: number; y: number; w: number; h: number } | null>(null);
  const counter = useRef(1);

  async function load(data: Uint8Array, name: string) {
    setFileName(stripExtension(name));
    setBytes(data);
    setPlaced([]);
    try {
      const f = await readFields(data);
      setFields(f);
      setValues(Object.fromEntries(f.map((x) => [x.name, x.value])));
      setMode(intent === 'design' ? 'design' : f.length ? 'fill' : 'design');
      if (f.length) toast(`Detectados ${f.length} campo(s) rellenable(s).`, 'info');
    } catch {
      setFields([]);
      setMode('design');
    }
  }

  useEffect(() => {
    const h = takeHandoff();
    if (h) load(h.bytes, h.filename);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    await load(data, file.name);
  }

  async function runFill() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const out = await fillFields(bytes, values, flatten);
      setResult({ bytes: out, filename: `${fileName}-relleno.pdf` });
    } catch {
      setError('No se pudo rellenar el formulario.');
    } finally {
      setBusy(false);
    }
  }

  // Genera el PDF con los campos AcroForm y lo descarga, SIN perder el diseño editable.
  async function exportForm() {
    if (!bytes || !placed.length) return;
    setBusy(true);
    setError(null);
    try {
      const out = await addFields(bytes, placed.map(({ id: _id, ...nf }) => nf));
      downloadBytes(out, `${fileName}-formulario.pdf`);
      toast(`Formulario con ${placed.length} campo(s) descargado. Puedes seguir editándolo.`, 'success');
    } catch {
      setError('No se pudieron crear los campos.');
    } finally {
      setBusy(false);
    }
  }

  // Aplica los campos y abre el modo Rellenar (para usarlos aquí mismo).
  async function applyAndFill() {
    if (!bytes || !placed.length) return;
    setBusy(true);
    setError(null);
    try {
      const out = await addFields(bytes, placed.map(({ id: _id, ...nf }) => nf));
      await load(out, `${fileName}.pdf`);
      toast('Campos aplicados. Ya puedes rellenarlos.', 'success');
    } catch {
      setError('No se pudieron crear los campos.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="forms" onReset={() => { setBytes(null); setResult(null); setFields([]); setPlaced([]); }} />;

  if (!bytes) {
    const MODES: { key: 'fill' | 'design'; icon: typeof PenLine; title: string; desc: string }[] = [
      { key: 'fill', icon: PenLine, title: 'Rellenar', desc: 'Abre un PDF con campos y rellénalos.' },
      { key: 'design', icon: Wand2, title: 'Crear campos', desc: 'Diseña un formulario sobre cualquier PDF.' },
    ];
    return (
      <div className="space-y-6">
        <FileDropzone accept="application/pdf" hint="Sube un PDF: rellena sus campos o diseña un formulario nuevo." onFiles={onFile} />

        <div>
          <p className="mb-2 text-center font-mono text-xs uppercase tracking-wide text-graphite">¿Qué quieres hacer?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map(({ key, icon: Icon, title, desc }) => (
              <button key={key} type="button" onClick={() => setIntent(key)} className={`rounded-[var(--radius-instrument)] border p-4 text-left transition-colors ${intent === key ? 'border-signal bg-signal/5' : 'border-line bg-paper-raised hover:border-signal/50'}`}>
                <span className={`grid size-9 place-items-center rounded-[8px] border ${intent === key ? 'border-signal/40 bg-signal/10 text-signal-deep' : 'border-line text-graphite'}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-2 font-display font-600 text-ink">{title}</p>
                <p className="mt-0.5 text-xs text-graphite">{desc}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-graphite">El cargador acepta cualquier PDF; detectamos el modo automáticamente. Todo se procesa en tu dispositivo.</p>
        </div>

        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="inline-flex rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-1 text-sm">
        <button type="button" onClick={() => setMode('fill')} className={`rounded-[6px] px-4 py-1.5 font-medium transition-colors ${mode === 'fill' ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}>
          Rellenar {fields.length > 0 && <span className="font-mono text-xs opacity-80">({fields.length})</span>}
        </button>
        <button type="button" onClick={() => setMode('design')} className={`rounded-[6px] px-4 py-1.5 font-medium transition-colors ${mode === 'design' ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}>
          Diseñar
        </button>
      </div>

      {mode === 'fill' ? (
        <FillPanel bytes={bytes} fields={fields} values={values} setValues={setValues} flatten={flatten} setFlatten={setFlatten} onRun={runFill} onDownloadBlank={() => downloadBytes(bytes, `${fileName}.pdf`)} busy={busy} />
      ) : (
        <DesignPanel bytes={bytes} designKind={designKind} setDesignKind={setDesignKind} placed={placed} setPlaced={setPlaced} draft={draft} setDraft={setDraft} counter={counter} onExport={exportForm} onApplyFill={applyAndFill} busy={busy} />
      )}
    </div>
  );
}

// ───────────────────────── Rellenar ─────────────────────────
function isFilled(f: FormField, v: FillValue | undefined): boolean {
  if (f.type === 'checkbox') return v === true;
  if (f.type === 'optionlist') return Array.isArray(v) && v.length > 0;
  return String(v ?? '').trim() !== '';
}

interface FillPanelProps {
  bytes: Uint8Array;
  fields: FormField[];
  values: Record<string, FillValue>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, FillValue>>>;
  flatten: boolean;
  setFlatten: (v: boolean) => void;
  onRun: () => void;
  onDownloadBlank: () => void;
  busy: boolean;
}
function FillPanel({ bytes, fields, values, setValues, flatten, setFlatten, onRun, onDownloadBlank, busy }: FillPanelProps) {
  const [view, setView] = useState<'visual' | 'list'>('visual');
  if (!fields.length) {
    return (
      <div className="rounded-[var(--radius-instrument)] border border-dashed border-line bg-paper-raised p-8 text-center text-graphite">
        <FormInput className="mx-auto size-8 text-signal-deep" aria-hidden />
        <p className="mt-3 font-display text-lg font-600 text-ink">Este PDF no tiene campos de formulario</p>
        <p className="mt-1 text-sm">Cambia a la pestaña <strong>Diseñar</strong> para crear campos sobre el documento.</p>
      </div>
    );
  }
  const set = (name: string, v: FillValue) => setValues((prev) => ({ ...prev, [name]: v }));
  const required = fields.filter((f) => f.required && !f.readOnly);
  const doneReq = required.filter((f) => isFilled(f, values[f.name])).length;
  const pct = required.length ? Math.round((doneReq / required.length) * 100) : 100;
  const optional = fields.filter((f) => !f.required && !f.readOnly).length;

  return (
    <div className="space-y-4">
      {/* Barra superior fija: progreso + vista + acciones (visibles sin tener que bajar) */}
      <div className="sticky top-16 z-20 -mx-1 space-y-2 border-b border-line bg-paper/95 px-1 pb-3 pt-1 backdrop-blur">
        {required.length > 0 && (
          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--color-signal-deep)' : 'linear-gradient(90deg, var(--color-ember), var(--color-signal))' }} />
            </div>
            <p className="mt-1.5 font-mono text-xs text-graphite">
              {pct === 100 ? '✓ Campos obligatorios completos' : `${doneReq} de ${required.length} campos obligatorios`}
              {optional > 0 && <span className="opacity-70"> · +{optional} opcionales</span>}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-0.5 text-sm">
            <button type="button" onClick={() => setView('visual')} className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 ${view === 'visual' ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}><LayoutPanelTop className="size-3.5" /> Documento</button>
            <button type="button" onClick={() => setView('list')} className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 ${view === 'list' ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}><List className="size-3.5" /> Lista</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-ink">
              <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} className="size-4 accent-[var(--color-signal-deep)]" /> Aplanar
            </label>
            <button type="button" onClick={onDownloadBlank} className="inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border border-line px-3 py-2 text-sm text-ink hover:border-signal/50"><FileDown className="size-4" aria-hidden /> Sin rellenar</button>
            <Button onClick={onRun} loading={busy}><Download className="size-4" aria-hidden /> Rellenar y descargar</Button>
          </div>
        </div>
      </div>

      {view === 'visual' ? (
        <VisualFill bytes={bytes} fields={fields} values={values} set={set} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => {
            const empty = f.required && !f.readOnly && !isFilled(f, values[f.name]);
            const ok = f.required && !f.readOnly && isFilled(f, values[f.name]);
            return (
              <div key={f.name} className={`rounded-[var(--radius-instrument)] border bg-paper-raised p-3 ${empty ? 'border-l-2 border-l-ember border-line' : ok ? 'border-l-2 border-l-signal border-line' : 'border-line'}`}>
                <label className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-ink">
                  <span className="truncate" title={f.name}>{f.name}{f.required && <span className="text-ember"> *</span>}</span>
                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-graphite">{f.type}</span>
                </label>
                {f.readOnly ? (
                  <p className="font-mono text-xs text-graphite">Solo lectura{f.value ? `: ${String(f.value)}` : ''}</p>
                ) : f.type === 'text' ? (
                  f.multiline ? (
                    <textarea value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} rows={3} className="w-full resize-y rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal" />
                  ) : (
                    <input value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} aria-required={f.required} className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal" />
                  )
                ) : f.type === 'checkbox' ? (
                  <label className="inline-flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="size-4 accent-[var(--color-signal-deep)]" />
                    Marcado
                  </label>
                ) : f.type === 'radio' || f.type === 'dropdown' ? (
                  <select value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} aria-required={f.required} className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal">
                    <option value="">— sin elegir —</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'optionlist' ? (
                  <select multiple value={Array.isArray(values[f.name]) ? (values[f.name] as string[]) : []} onChange={(e) => set(f.name, Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal">
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <p className="font-mono text-xs text-graphite">No editable</p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// Vista "Documento": el PDF renderizado con inputs editables superpuestos en cada campo.
interface VisualFillProps {
  bytes: Uint8Array;
  fields: FormField[];
  values: Record<string, FillValue>;
  set: (name: string, v: FillValue) => void;
}
function VisualFill({ bytes, fields, values, set }: VisualFillProps) {
  const { pages, loading } = usePdfPages(bytes, 820);
  const [widgets, setWidgets] = useState<WidgetRect[]>([]);
  const { zoom, zin, zout, reset: zoomReset } = useZoom();
  const byName = new Map(fields.map((f) => [f.name, f]));

  useEffect(() => {
    let alive = true;
    readWidgetRects(bytes).then((w) => { if (alive) setWidgets(w); }).catch(() => setWidgets([]));
    return () => { alive = false; };
  }, [bytes]);

  if (loading) return <p className="py-8 text-center text-graphite">Cargando documento…</p>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full justify-end">
        <ZoomBar zoom={zoom} zin={zin} zout={zout} reset={zoomReset} />
      </div>
      {pages.map((page, pageIndex) => {
        const s = page.displayScale * zoom;
        return (
          <div key={page.pageNumber} className="relative shadow-[0_4px_24px_-12px_rgba(20,22,27,0.3)]" style={{ width: page.widthPt * s, height: page.heightPt * s }}>
            <img src={page.dataUrl} alt={`Página ${page.pageNumber}`} className="block size-full select-none" draggable={false} />
            {widgets.filter((w) => w.page === pageIndex).map((w, i) => {
              const f = byName.get(w.name);
              if (!f) return null;
              const style: React.CSSProperties = { position: 'absolute', left: w.x * s, top: w.y * s, width: w.width * s, height: w.height * s };
              const fs = Math.max(9, Math.min(15, w.height * s * 0.6));
              if (f.readOnly || f.type === 'button' || f.type === 'unknown') {
                return <div key={i} style={style} className="rounded-[2px] bg-ink/3" title="Solo lectura" />;
              }
              if (f.type === 'text') {
                return f.multiline
                  ? <textarea key={i} style={{ ...style, fontSize: fs }} value={String(values[w.name] ?? '')} onChange={(e) => set(w.name, e.target.value)} aria-label={w.name} placeholder={f.tooltip || undefined} className="form-fill resize-none" />
                  : <input key={i} style={{ ...style, fontSize: fs }} value={String(values[w.name] ?? '')} onChange={(e) => set(w.name, e.target.value)} aria-label={w.name} aria-required={f.required} placeholder={f.tooltip || undefined} className="form-fill" />;
              }
              if (f.type === 'checkbox') {
                return <input key={i} type="checkbox" style={style} checked={Boolean(values[w.name])} onChange={(e) => set(w.name, e.target.checked)} aria-label={w.name} className="form-fill cursor-pointer accent-[var(--color-signal-deep)]" />;
              }
              if (f.type === 'radio') {
                const val = w.exportValue ?? '';
                return <input key={i} type="radio" name={w.name} style={style} checked={String(values[w.name] ?? '') === val} onChange={() => set(w.name, val)} aria-label={`${w.name}: ${val}`} className="form-fill cursor-pointer accent-[var(--color-signal-deep)]" />;
              }
              if (f.type === 'dropdown') {
                return (
                  <select key={i} style={{ ...style, fontSize: fs }} value={String(values[w.name] ?? '')} onChange={(e) => set(w.name, e.target.value)} aria-label={w.name} className="form-fill cursor-pointer">
                    <option value=""></option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────── Diseñar ─────────────────────────
interface DesignPanelProps {
  bytes: Uint8Array;
  designKind: DesignTool;
  setDesignKind: (k: DesignTool) => void;
  placed: Placed[];
  setPlaced: React.Dispatch<React.SetStateAction<Placed[]>>;
  draft: { page: number; x: number; y: number; w: number; h: number } | null;
  setDraft: (d: { page: number; x: number; y: number; w: number; h: number } | null) => void;
  counter: React.RefObject<number>;
  onExport: () => void;
  onApplyFill: () => void;
  busy: boolean;
}
function DesignPanel({ bytes, designKind, setDesignKind, placed, setPlaced, draft, setDraft, counter, onExport, onApplyFill, busy }: DesignPanelProps) {
  const { pages, loading } = usePdfPages(bytes, 760);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [testValues, setTestValues] = useState<Record<string, string | boolean>>({});
  const { zoom, zin, zout, reset: zoomReset } = useZoom();
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const clipboardRef = useRef<Placed[]>([]);
  const pagesRef = useRef<EditorPage[]>(pages);
  pagesRef.current = pages;
  const placedRef = useRef<Placed[]>(placed);
  placedRef.current = placed;
  const selectMode = designKind === 'select';
  const selected = placed.find((p) => p.id === selectedId) ?? null;

  const update = (id: string, patch: Partial<Placed>) => setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  useEffect(() => {
    interact('.forms-field').draggable({
      listeners: {
        move: (e) => {
          const id = (e.target as HTMLElement).dataset.id!;
          const f = placedRef.current.find((p) => p.id === id);
          const scale = (pagesRef.current[f?.page ?? 0]?.displayScale ?? 1) * zoomRef.current;
          setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, x: p.x + e.dx / scale, y: p.y + e.dy / scale } : p)));
        },
      },
    });
    return () => interact('.forms-field').unset();
  }, [setPlaced]);

  // Atajos de teclado del constructor (informe §10.3).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      const meta = e.ctrlKey || e.metaKey;
      const sel = placedRef.current.find((p) => p.id === selectedId) ?? null;
      if (meta) {
        const k = e.key.toLowerCase();
        if (k === 'd') { e.preventDefault(); if (sel) duplicate(sel); }
        else if (k === 'c') { if (sel) copySelected(sel); }
        else if (k === 'x') { if (sel) cutSelected(sel); }
        else if (k === 'v') { e.preventDefault(); pasteClipboard(); }
        else if (k === '=' || k === '+') { e.preventDefault(); zin(); }
        else if (k === '-' || k === '_') { e.preventDefault(); zout(); }
        else if (k === '0') { e.preventDefault(); zoomReset(); }
        return;
      }
      switch (e.key) {
        case 'v': case 'V': setDesignKind('select'); break;
        case 't': case 'T': setDesignKind('text'); break;
        case 'a': case 'A': setDesignKind('textarea'); break;
        case 'c': case 'C': setDesignKind('checkbox'); break;
        case 'r': case 'R': setDesignKind('radio'); break;
        case 'd': case 'D': setDesignKind('dropdown'); break;
        case 'Escape': setDesignKind('select'); setSelectedId(null); break;
        case 'Delete': case 'Backspace':
          if (sel) { setPlaced((prev) => prev.filter((p) => p.id !== sel.id)); setSelectedId(null); }
          break;
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
          if (!sel) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          update(sel.id, { x: sel.x + dx, y: sel.y + dy });
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, setDesignKind, setPlaced]);

  function local(e: ReactPointerEvent, scale: number) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  function down(e: ReactPointerEvent, page: number, scale: number) {
    if (selectMode || previewMode) { setSelectedId(null); return; }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = local(e, scale);
    setDraft({ page, x: p.x, y: p.y, w: 0, h: 0 });
  }
  function move(e: ReactPointerEvent, page: number, scale: number) {
    if (!draft || draft.page !== page) return;
    const p = local(e, scale);
    setDraft({ ...draft, w: p.x - draft.x, h: p.y - draft.y });
  }
  function up() {
    if (!draft || selectMode) return;
    const x = Math.min(draft.x, draft.x + draft.w);
    const y = Math.min(draft.y, draft.y + draft.h);
    const w = Math.abs(draft.w);
    const h = Math.abs(draft.h);
    setDraft(null);
    if (w < 12 || h < 8) return;
    const kind = designKind as NewFieldKind;
    const n = counter.current++;
    const stub = kind === 'checkbox' ? 'casilla' : kind === 'radio' ? 'opcion' : kind === 'dropdown' ? 'lista' : 'campo';
    const base: Placed = { id: crypto.randomUUID(), kind, name: `${stub}_${n}`, label: '', page: draft.page, x, y, width: w, height: h };
    if (kind === 'dropdown' || kind === 'radio') base.options = ['Opción 1', 'Opción 2'];
    setPlaced((prev) => [...prev, base]);
    setSelectedId(base.id);
    setDesignKind('select'); // recién creado = editable al instante (mover/redimensionar/propiedades)
  }
  function duplicate(f: Placed) {
    const n = counter.current++;
    const copy: Placed = { ...f, id: crypto.randomUUID(), name: `${f.name.replace(/_\d+$/, '')}_${n}`, x: f.x + 12, y: f.y + 12, options: f.options ? [...f.options] : undefined };
    setPlaced((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  }
  function copySelected(f: Placed) {
    clipboardRef.current = [{ ...f, options: f.options ? [...f.options] : undefined }];
    toast('Campo copiado. Pega con Ctrl/Cmd+V.', 'info');
  }
  function cutSelected(f: Placed) {
    clipboardRef.current = [{ ...f, options: f.options ? [...f.options] : undefined }];
    setPlaced((prev) => prev.filter((p) => p.id !== f.id));
    setSelectedId(null);
    toast('Campo cortado.', 'info');
  }
  function pasteClipboard() {
    const buf = clipboardRef.current;
    if (!buf.length) return;
    const created: Placed[] = buf.map((f) => {
      const n = counter.current++;
      return { ...f, id: crypto.randomUUID(), name: `${f.name.replace(/_\d+$/, '')}_${n}`, x: f.x + 14, y: f.y + 14, options: f.options ? [...f.options] : undefined };
    });
    setPlaced((prev) => [...prev, ...created]);
    setSelectedId(created[created.length - 1]!.id);
    setDesignKind('select');
  }

  const TOOLS: { k: DesignTool; icon: typeof Type; label: string }[] = [
    { k: 'select', icon: MousePointer2, label: 'Mover' },
    { k: 'text', icon: Type, label: 'Texto' },
    { k: 'textarea', icon: Pilcrow, label: 'Área' },
    { k: 'checkbox', icon: CheckSquare, label: 'Casilla' },
    { k: 'radio', icon: CircleDot, label: 'Opción' },
    { k: 'dropdown', icon: ChevronDownSquare, label: 'Lista' },
  ];

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-9rem)] lg:flex-row lg:items-stretch">
      <div className="min-w-0 flex-1 lg:flex lg:min-h-0 lg:flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 lg:shrink-0">
          <p className="rounded-[var(--radius-instrument)] border border-signal/30 bg-signal/5 px-3 py-1.5 text-sm text-signal-deep">
            {previewMode ? <>Vista previa: prueba el formulario como un usuario final.</> : selectMode ? <>Modo <strong>Mover</strong>: arrastra o redimensiona con los tiradores.</> : <>Elige un campo y <strong>arrastra</strong> sobre el documento.</>}
          </p>
          <div className="flex items-center gap-2">
            <ZoomBar zoom={zoom} zin={zin} zout={zout} reset={zoomReset} />
            <button type="button" onClick={() => { setPreviewMode((v) => !v); setSelectedId(null); }} className={`inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border px-3 py-1.5 text-sm ${previewMode ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:text-ink'}`}>
              {previewMode ? <Pencil className="size-4" /> : <Eye className="size-4" />} {previewMode ? 'Editar' : 'Vista previa'}
            </button>
          </div>
        </div>
        {loading && <p className="py-8 text-center text-graphite">Cargando páginas…</p>}
        <div className="flex flex-col items-center gap-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
          {pages.map((page, pageIndex) => {
            const s = page.displayScale * zoom;
            const wPx = page.widthPt * s;
            const hPx = page.heightPt * s;
            const sel = placed.find((f) => f.id === selectedId && f.page === pageIndex) ?? null;
            return (
              <div key={page.pageNumber} className="relative shadow-[0_4px_24px_-12px_rgba(20,22,27,0.3)]" style={{ width: wPx, height: hPx }}>
                <img src={page.dataUrl} alt={`Página ${page.pageNumber}`} className="block size-full select-none" draggable={false} />
                {!previewMode && (
                  <div className={`absolute inset-0 ${selectMode ? '' : 'cursor-crosshair'}`} onPointerDown={(e) => down(e, pageIndex, s)} onPointerMove={(e) => move(e, pageIndex, s)} onPointerUp={up} />
                )}
                {placed.filter((f) => f.page === pageIndex).map((f) => (
                  previewMode
                    ? <PreviewField key={f.id} f={f} s={s} value={testValues[f.id]} onChange={(v) => setTestValues((prev) => ({ ...prev, [f.id]: v }))} />
                    : <FieldBox key={f.id} f={f} s={s} selected={selectedId === f.id} onSelect={() => { setSelectedId(f.id); setDesignKind('select'); }} />
                ))}
                {!previewMode && selectMode && sel && (
                  <SelectionFrame
                    box={{ x: sel.x, y: sel.y, width: sel.width, height: sel.height }}
                    rotation={0}
                    scale={s}
                    onStart={() => { /* sin historial */ }}
                    onChange={(partial) => update(sel.id, partial)}
                    rotatable={false}
                  />
                )}
                {draft && draft.page === pageIndex && (
                  <div className="pointer-events-none absolute rounded-sm border-2 border-dashed border-signal bg-signal/10" style={{ left: Math.min(draft.x, draft.x + draft.w) * s, top: Math.min(draft.y, draft.y + draft.h) * s, width: Math.abs(draft.w) * s, height: Math.abs(draft.h) * s }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel lateral */}
      <aside className="space-y-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-3 lg:max-h-full lg:w-72 lg:shrink-0 lg:overflow-y-auto">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Herramienta</p>
          <div className="grid grid-cols-3 gap-1.5">
            {TOOLS.map(({ k, icon: Icon, label }) => (
              <button key={k} type="button" onClick={() => { setDesignKind(k); if (k !== 'select') setSelectedId(null); }} className={`flex flex-col items-center gap-1 rounded border p-2 text-[11px] ${designKind === k ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:text-ink'}`}>
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-line" />

        {selected ? (
          <PropertyPanel f={selected} update={(patch) => update(selected.id, patch)} onDuplicate={() => duplicate(selected)} onRemove={() => { setPlaced((prev) => prev.filter((p) => p.id !== selected.id)); setSelectedId(null); }} />
        ) : (
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Campos ({placed.length})</p>
            {placed.length === 0 ? (
              <p className="text-sm text-graphite">Aún no hay campos. Dibuja uno sobre el documento.</p>
            ) : (
              <ul className="space-y-1">
                {placed.map((f) => {
                  const Icon = KIND_ICON[f.kind];
                  return (
                    <li key={f.id}>
                      <button type="button" onClick={() => { setDesignKind('select'); setSelectedId(f.id); }} className="flex w-full items-center gap-2 rounded border border-line px-2 py-1.5 text-left text-sm text-ink hover:border-signal/50">
                        <Icon className="size-3.5 shrink-0 text-graphite" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        {f.required && <span className="text-ember">*</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Button onClick={onExport} loading={busy} disabled={!placed.length} className="w-full"><FileDown className="size-4" aria-hidden /> Descargar formulario</Button>
          <button type="button" onClick={onApplyFill} disabled={!placed.length || busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-instrument)] border border-line py-2 text-sm text-ink hover:border-signal/50 disabled:opacity-50"><Wand2 className="size-4" aria-hidden /> Aplicar y rellenar aquí</button>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-graphite">Pulsa <strong>Vista previa</strong> para probarlo en cualquier momento; sigues editando sin perder nada. Atajos: <kbd>T</kbd> <kbd>A</kbd> <kbd>C</kbd> <kbd>R</kbd> <kbd>D</kbd> · <kbd>V</kbd> mover · <kbd>Ctrl+C/V</kbd> copiar/pegar · <kbd>Ctrl+D</kbd> dup · <kbd>Supr</kbd> borrar · <kbd>Ctrl</kbd> <kbd>+</kbd>/<kbd>−</kbd>/<kbd>0</kbd> zoom.</p>
      </aside>
    </div>
  );
}

interface FieldBoxProps {
  f: Placed;
  s: number;
  selected: boolean;
  onSelect: () => void;
}
// Caja editable de un campo. Clicable con cualquier herramienta (clic = enfocar/editar).
function FieldBox({ f, s, selected, onSelect }: FieldBoxProps) {
  const style: React.CSSProperties = { left: f.x * s, top: f.y * s, width: f.width * s, height: f.height * s, pointerEvents: 'auto', cursor: 'move', touchAction: 'none' };
  return (
    <div data-id={f.id} onPointerDown={onSelect} className={`forms-field absolute flex items-center justify-center overflow-hidden rounded-sm border-2 text-[10px] font-medium ${selected ? 'border-signal-deep bg-signal/20' : 'border-dashed border-signal bg-signal/10'} text-signal-deep`} style={style}>
      {f.name}{f.required ? ' *' : ''}
    </div>
  );
}

// Campo rellenable en Vista previa (probar el formulario sin generarlo todavía).
interface PreviewFieldProps {
  f: Placed;
  s: number;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}
function PreviewField({ f, s, value, onChange }: PreviewFieldProps) {
  const style: React.CSSProperties = { position: 'absolute', left: f.x * s, top: f.y * s, width: f.width * s, height: f.height * s };
  const autoFs = Math.max(9, Math.min(15, f.height * s * 0.55));
  // Apariencia fiel a lo elegido (fuente/tamaño/estilo/color/alineación).
  const text: React.CSSProperties = {
    fontFamily: FONT_CSS[f.fontFamily ?? 'Helvetica'],
    fontSize: f.fontSize && f.fontSize > 0 ? f.fontSize * s : autoFs,
    fontWeight: f.bold ? 700 : 400,
    fontStyle: f.italic ? 'italic' : 'normal',
    color: f.textColor ?? undefined,
    textAlign: f.align ?? 'left',
  };
  const fs = autoFs;
  if (f.kind === 'text') return <input className="form-fill" style={{ ...style, ...text }} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={f.name} placeholder={f.placeholder || undefined} />;
  if (f.kind === 'textarea') return <textarea className="form-fill resize-none" style={{ ...style, ...text }} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={f.name} placeholder={f.placeholder || undefined} />;
  if (f.kind === 'checkbox') return <input type="checkbox" className="form-fill cursor-pointer accent-[var(--color-signal-deep)]" style={style} checked={value === true} onChange={(e) => onChange(e.target.checked)} aria-label={f.name} />;
  if (f.kind === 'dropdown') return (
    <select className="form-fill cursor-pointer" style={{ ...style, ...text }} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={f.name}>
      <option value=""></option>
      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  // radio: opciones apiladas
  return (
    <div style={style} className="flex flex-col justify-around rounded-sm border border-signal/30 bg-signal/5 px-1">
      {(f.options ?? []).map((o) => (
        <label key={o} className="flex items-center gap-1 text-[10px] text-ink" style={{ fontSize: Math.min(fs, 12) }}>
          <input type="radio" name={f.id} checked={value === o} onChange={() => onChange(o)} className="accent-[var(--color-signal-deep)]" /> {o}
        </label>
      ))}
    </div>
  );
}

interface PropertyPanelProps {
  f: Placed;
  update: (patch: Partial<Placed>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}
function PropertyPanel({ f, update, onDuplicate, onRemove }: PropertyPanelProps) {
  const KINDS: NewFieldKind[] = ['text', 'textarea', 'checkbox', 'radio', 'dropdown'];
  const hasOptions = f.kind === 'dropdown' || f.kind === 'radio';
  const num = (v: number) => Math.round(v);
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-wide text-graphite">Propiedades del campo</p>

      {/* General */}
      <div className="space-y-1.5">
        <Field label="Nombre">
          <input value={f.name} onChange={(e) => update({ name: e.target.value })} className="prop-input" />
        </Field>
        <Field label="Etiqueta">
          <input value={f.label ?? ''} onChange={(e) => update({ label: e.target.value })} placeholder="Texto visible (accesibilidad)" className="prop-input" />
        </Field>
        {(f.kind === 'text' || f.kind === 'textarea') && (
          <Field label="Texto de referencia (placeholder)">
            <input value={f.placeholder ?? ''} onChange={(e) => update({ placeholder: e.target.value })} placeholder='Ej.: "Pon tu nombre aquí"' className="prop-input" />
          </Field>
        )}
        <Field label="Tipo">
          <select value={f.kind} onChange={(e) => { const kind = e.target.value as NewFieldKind; update({ kind, options: (kind === 'dropdown' || kind === 'radio') ? (f.options ?? ['Opción 1', 'Opción 2']) : undefined }); }} className="prop-input">
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </Field>
      </div>

      {hasOptions && (
        <Field label="Opciones (una por línea)">
          <textarea value={(f.options ?? []).join('\n')} onChange={(e) => update({ options: e.target.value.split('\n').map((o) => o.trim()).filter(Boolean) })} rows={3} className="prop-input resize-y" />
        </Field>
      )}

      {/* Validación */}
      <div className="rounded border border-line p-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!f.required} onChange={(e) => update({ required: e.target.checked })} className="size-4 accent-[var(--color-signal-deep)]" /> Obligatorio
        </label>
        <label className="mt-1.5 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!f.readOnly} onChange={(e) => update({ readOnly: e.target.checked })} className="size-4 accent-[var(--color-signal-deep)]" /> Solo lectura
        </label>
        {(f.kind === 'text' || f.kind === 'textarea') && (
          <div className="mt-1.5">
            <Field label="Máx. caracteres (0 = sin límite)">
              <input type="number" min={0} value={f.maxLength ?? 0} onChange={(e) => update({ maxLength: Math.max(0, Number(e.target.value) || 0) })} className="prop-input" />
            </Field>
          </div>
        )}
      </div>

      {/* Apariencia (grosor y forma de la caja) */}
      <div className="space-y-1.5 rounded border border-line p-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-graphite">Apariencia</p>
        <label className="block">
          <span className="mb-0.5 flex items-center justify-between font-mono text-[11px] text-graphite">Grosor del borde <span>{f.borderWidth ?? 1}px</span></span>
          <input type="range" min={0} max={4} step={0.5} value={f.borderWidth ?? 1} onChange={(e) => update({ borderWidth: Number(e.target.value) })} className="w-full accent-[var(--color-signal-deep)]" />
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-ink">
            <input type="color" value={f.borderColor ?? '#0a8c81'} onChange={(e) => update({ borderColor: e.target.value })} className="size-6 cursor-pointer rounded border border-line bg-paper" /> Borde
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink">
            <input type="color" value={f.backgroundColor ?? '#ffffff'} onChange={(e) => update({ backgroundColor: e.target.value })} disabled={f.backgroundColor == null} className="size-6 cursor-pointer rounded border border-line bg-paper disabled:opacity-40" /> Fondo
          </label>
          <label className="flex items-center gap-1.5 text-xs text-graphite">
            <input type="checkbox" checked={f.backgroundColor == null} onChange={(e) => update({ backgroundColor: e.target.checked ? null : '#ffffff' })} className="size-3.5 accent-[var(--color-signal-deep)]" /> Transparente
          </label>
        </div>
      </div>

      {/* Texto (fuente / tamaño / estilo / color / alineación) */}
      {(f.kind === 'text' || f.kind === 'textarea' || f.kind === 'dropdown') && (
        <div className="space-y-1.5 rounded border border-line p-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-graphite">Texto</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Fuente">
              <select value={f.fontFamily ?? 'Helvetica'} onChange={(e) => update({ fontFamily: e.target.value as FormFontFamily })} className="prop-input">
                <option value="Helvetica">Helvetica</option>
                <option value="Times">Times</option>
                <option value="Courier">Courier</option>
              </select>
            </Field>
            <Field label="Tamaño (0 = auto)">
              <input type="number" min={0} max={96} value={f.fontSize ?? 0} onChange={(e) => update({ fontSize: Math.max(0, Math.min(96, Number(e.target.value) || 0)) })} className="prop-input" />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => update({ bold: !f.bold })} aria-pressed={!!f.bold} title="Negrita" className={`grid size-7 place-items-center rounded border ${f.bold ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:text-ink'}`}><Bold className="size-3.5" /></button>
            <button type="button" onClick={() => update({ italic: !f.italic })} aria-pressed={!!f.italic} title="Cursiva" className={`grid size-7 place-items-center rounded border ${f.italic ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:text-ink'}`}><Italic className="size-3.5" /></button>
            <label className="ml-1 flex items-center gap-1.5 text-xs text-ink">
              <input type="color" value={f.textColor ?? '#14161b'} onChange={(e) => update({ textColor: e.target.value })} className="size-6 cursor-pointer rounded border border-line bg-paper" /> Color
            </label>
            {(f.kind === 'text' || f.kind === 'textarea') && (
              <div className="ml-auto inline-flex rounded border border-line p-0.5">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                  <button key={a} type="button" onClick={() => update({ align: a })} title={a} className={`grid size-6 place-items-center rounded ${(f.align ?? 'left') === a ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}><Icon className="size-3.5" /></button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Posición */}
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="X"><input type="number" value={num(f.x)} onChange={(e) => update({ x: Number(e.target.value) || 0 })} className="prop-input" /></Field>
        <Field label="Y"><input type="number" value={num(f.y)} onChange={(e) => update({ y: Number(e.target.value) || 0 })} className="prop-input" /></Field>
        <Field label="Ancho"><input type="number" value={num(f.width)} onChange={(e) => update({ width: Math.max(8, Number(e.target.value) || 8) })} className="prop-input" /></Field>
        <Field label="Alto"><input type="number" value={num(f.height)} onChange={(e) => update({ height: Math.max(8, Number(e.target.value) || 8) })} className="prop-input" /></Field>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onDuplicate} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-line py-1.5 text-sm text-ink hover:border-signal/50"><Copy className="size-4" /> Duplicar</button>
        <button type="button" onClick={onRemove} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-ember/40 bg-ember/10 py-1.5 text-sm text-ember"><Trash2 className="size-4" /> Borrar</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block font-mono text-[11px] text-graphite">{label}</span>
      {children}
    </label>
  );
}
