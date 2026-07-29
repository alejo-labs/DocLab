import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { EyeOff, X } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { usePdfPages } from '../../lib/pdf/usePdfPages';
import { takeHandoff } from '../../lib/handoff';
import type { RedactBox, RedactStyle } from '../../lib/pdf/redact';
import type { ToolEngineProps, ToolResult } from './types';

interface Box extends RedactBox { id: string }

export function RedactTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [style, setStyle] = useState<RedactStyle>('black');
  const [draft, setDraft] = useState<{ page: number; x: number; y: number; w: number; h: number } | null>(null);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  useEffect(() => {
    const h = takeHandoff();
    if (h) { setFileName(stripExtension(h.filename)); setBytes(h.bytes); }
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    setBytes(data);
    setBoxes([]);
  }

  async function run() {
    if (!bytes || boxes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { redactPdf } = await import('../../lib/pdf/redact');
      const out = await redactPdf(bytes, boxes.map(({ id: _id, ...b }) => b), style);
      setResult({ bytes: out, filename: `${fileName}-censurado.pdf` });
    } catch {
      setError('No se pudo censurar el PDF.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="redact" onReset={() => { setResult(null); setBytes(null); setBoxes([]); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF y tapa la información sensible: esa zona se borra de verdad y el resto del texto sigue seleccionable. Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const remove = (id: string) => setBoxes((prev) => prev.filter((b) => b.id !== id));
  const moveBox = (id: string, x: number, y: number) => setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, x, y } : b)));

  return (
    <div className="space-y-4">
      {error && <ErrorAlert message={error} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rounded-[var(--radius-instrument)] border border-signal/30 bg-signal/5 px-3 py-1.5 text-sm text-signal-deep">Arrastra para <strong>tapar</strong>; mueve una caja arrastrándola; bórrala con la ✕. {boxes.length > 0 && `${boxes.length} zona(s).`}</p>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-[var(--radius-instrument)] border border-line p-0.5 text-sm">
            {(['black', 'white'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStyle(s)} className={`rounded-[5px] px-3 py-1 ${style === s ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}>{s === 'black' ? 'Negro' : 'Blanco'}</button>
            ))}
          </div>
          {boxes.length > 0 && <button type="button" onClick={() => setBoxes([])} className="text-sm text-graphite hover:text-ink">Limpiar</button>}
          <Button onClick={run} loading={busy} disabled={boxes.length === 0}><EyeOff className="size-4" aria-hidden /> Censurar y descargar</Button>
        </div>
      </div>
      <p className="font-mono text-[11px] text-graphite">El resto del texto de la página <strong>se conserva seleccionable</strong>; solo desaparece lo que tapes.</p>
      <RedactCanvas bytes={bytes} boxes={boxes} setBoxes={setBoxes} draft={draft} setDraft={setDraft} style={style} onRemove={remove} onMove={moveBox} />
    </div>
  );
}

interface CanvasProps {
  bytes: Uint8Array;
  boxes: Box[];
  setBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  draft: { page: number; x: number; y: number; w: number; h: number } | null;
  setDraft: (d: { page: number; x: number; y: number; w: number; h: number } | null) => void;
  style: RedactStyle;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}
function RedactCanvas({ bytes, boxes, setBoxes, draft, setDraft, style, onRemove, onMove }: CanvasProps) {
  const { pages, loading } = usePdfPages(bytes, 820);
  if (loading) return <p className="py-8 text-center text-graphite">Cargando documento…</p>;

  function local(e: ReactPointerEvent, scale: number) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {pages.map((page, pageIndex) => {
        const s = page.displayScale;
        return (
          <div key={page.pageNumber} className="relative shadow-[0_4px_24px_-12px_rgba(20,22,27,0.3)]" style={{ width: page.widthPt * s, height: page.heightPt * s }}>
            <img src={page.dataUrl} alt={`Página ${page.pageNumber}`} className="block size-full select-none" draggable={false} />
            <div
              className="absolute inset-0 cursor-crosshair touch-none"
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const p = local(e, s); setDraft({ page: pageIndex, x: p.x, y: p.y, w: 0, h: 0 }); }}
              onPointerMove={(e) => { if (!draft || draft.page !== pageIndex) return; const p = local(e, s); setDraft({ ...draft, w: p.x - draft.x, h: p.y - draft.y }); }}
              onPointerUp={() => {
                if (!draft || draft.page !== pageIndex) return;
                const x = Math.min(draft.x, draft.x + draft.w);
                const y = Math.min(draft.y, draft.y + draft.h);
                const w = Math.abs(draft.w);
                const h = Math.abs(draft.h);
                setDraft(null);
                if (w < 5 || h < 5) return;
                setBoxes((prev) => [...prev, { id: crypto.randomUUID(), page: pageIndex, x, y, w, h }]);
              }}
            />
            {boxes.filter((b) => b.page === pageIndex).map((b) => (
              <RedactBoxView key={b.id} b={b} s={s} style={style} onRemove={() => onRemove(b.id)} onMove={(x, y) => onMove(b.id, x, y)} />
            ))}
            {draft && draft.page === pageIndex && (
              <div className="pointer-events-none absolute bg-ink/70" style={{ left: Math.min(draft.x, draft.x + draft.w) * s, top: Math.min(draft.y, draft.y + draft.h) * s, width: Math.abs(draft.w) * s, height: Math.abs(draft.h) * s }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BoxViewProps { b: Box; s: number; style: RedactStyle; onRemove: () => void; onMove: (x: number, y: number) => void }
function RedactBoxView({ b, s, style, onRemove, onMove }: BoxViewProps) {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  return (
    <div
      className={`group absolute cursor-move touch-none ${style === 'white' ? 'border border-line bg-white' : 'bg-ink'}`}
      style={{ left: b.x * s, top: b.y * s, width: b.w * s, height: b.h * s }}
      onPointerDown={(e) => { if ((e.target as HTMLElement).closest('button')) return; e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag.current = { px: e.clientX, py: e.clientY, x: b.x, y: b.y }; }}
      onPointerMove={(e) => { if (!drag.current) return; onMove(drag.current.x + (e.clientX - drag.current.px) / s, drag.current.y + (e.clientY - drag.current.py) / s); }}
      onPointerUp={(e) => { drag.current = null; (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }}
    >
      <button type="button" onClick={onRemove} className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-ember text-paper opacity-0 shadow group-hover:opacity-100" aria-label="Quitar"><X className="size-3" /></button>
    </div>
  );
}
