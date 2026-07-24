import { useEffect, useRef, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import Sortable from 'sortablejs';
import { GripVertical, RotateCw, Save, Trash2 } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { usePdfThumbnails } from '../../lib/pdf/usePdfThumbnails';
import { normalizeRotation, rebuildPdf, type PagePlan } from '../../lib/pdf/organize';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import type { ToolEngineProps, ToolResult } from './types';

interface PageItem {
  key: string;
  sourceIndex: number;
  rotation: number;
  dataUrl: string;
}

const HINTS = {
  organize: 'Sube un PDF para reordenar sus páginas (arrastrando), rotarlas o eliminarlas.',
  rotate: 'Sube un PDF para girar páginas individuales o todo el documento.',
  delete: 'Sube un PDF y elimina las páginas que no necesitas.',
} as const;

export function OrganizeTool({ preset }: ToolEngineProps) {
  const focus = preset?.focus ?? 'organize';

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [pages, setPages] = useState<PageItem[]>([]);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  const { thumbnails, pageCount, loading, error: loadError } = usePdfThumbnails(bytes);
  const gridRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) {
      setFileName(stripExtension(handoff.filename));
      setBytes(handoff.bytes);
    }
  }, []);

  useEffect(() => {
    if (!bytes || loading || pageCount === 0 || thumbnails.length !== pageCount) return;
    if (initializedRef.current === bytes) return;
    initializedRef.current = bytes;
    setPages(
      thumbnails.map((thumb) => ({
        key: `p-${thumb.pageNumber}`,
        sourceIndex: thumb.pageNumber - 1,
        rotation: 0,
        dataUrl: thumb.dataUrl,
      })),
    );
  }, [bytes, loading, pageCount, thumbnails]);

  // Drag & drop (solo relevante cuando se puede reordenar).
  useEffect(() => {
    if (!gridRef.current || pages.length === 0 || focus === 'delete') return;
    const sortable = Sortable.create(gridRef.current, {
      animation: 160,
      handle: '.drag-handle',
      ghostClass: 'opacity-40',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        setPages((prev) => {
          const next = [...prev];
          const [moved] = next.splice(oldIndex, 1);
          if (moved) next.splice(newIndex, 0, moved);
          return next;
        });
      },
    });
    return () => sortable.destroy();
  }, [pages.length, focus]);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) {
      setError(`"${file.name}" no es un PDF válido.`);
      return;
    }
    setFileName(stripExtension(file.name));
    setPages([]);
    setSelected(new Set());
    initializedRef.current = null;
    setBytes(data);
  }

  function rotate(key: string) {
    setPages((prev) =>
      prev.map((page) =>
        page.key === key ? { ...page, rotation: normalizeRotation(page.rotation + 90) } : page,
      ),
    );
  }

  function rotateAll() {
    setPages((prev) => prev.map((page) => ({ ...page, rotation: normalizeRotation(page.rotation + 90) })));
  }

  function remove(key: string) {
    setPages((prev) => prev.filter((page) => page.key !== key));
  }

  // ── Selección múltiple (Shift+clic para rango) ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastIdx = useRef<number | null>(null);
  function clickSel(index: number, key: string, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIdx.current !== null) {
        const [a, b] = [lastIdx.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i += 1) {
          const k = pages[i]?.key;
          if (k) next.add(k);
        }
      } else if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    lastIdx.current = index;
  }
  function rotateSelected() {
    setPages((prev) => prev.map((p) => (selected.has(p.key) ? { ...p, rotation: normalizeRotation(p.rotation + 90) } : p)));
  }
  function removeSelected() {
    setPages((prev) => prev.filter((p) => !selected.has(p.key)));
    setSelected(new Set());
  }

  function reset() {
    setBytes(null);
    setResult(null);
    setPages([]);
    setSelected(new Set());
    initializedRef.current = null;
  }

  async function run() {
    if (!bytes) return;
    setError(null);
    setBusy(true);
    try {
      const plan: PagePlan[] = pages.map((page) => ({ sourceIndex: page.sourceIndex, rotation: page.rotation }));
      const out = await rebuildPdf(bytes, plan);
      setResult({ bytes: out, filename: `${fileName}-editado.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el documento.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return <ResultPreview result={result} currentEngine="organize" onReset={reset} />;
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint={HINTS[focus]} onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || loadError) && <ErrorAlert message={error ?? loadError!} />}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-graphite">
        <span className="font-mono text-xs">
          {pages.length} de {pageCount} páginas
          {focus !== 'delete' && ' · arrastra para reordenar'}
        </span>
        <div className="flex items-center gap-3">
          {focus !== 'delete' && (
            <button type="button" onClick={rotateAll} className="inline-flex items-center gap-1.5 hover:text-ink">
              <RotateCw className="size-3.5" aria-hidden />
              Rotar todas
            </button>
          )}
          <button type="button" onClick={reset} className="hover:text-ink">
            Cambiar archivo
          </button>
        </div>
      </div>

      {/* Barra de acciones en lote */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 px-3 py-2 text-sm">
          <span className="font-mono text-xs text-signal-deep">{selected.size} seleccionadas</span>
          {focus !== 'delete' && (
            <button type="button" onClick={rotateSelected} className="inline-flex items-center gap-1.5 text-ink hover:text-signal-deep">
              <RotateCw className="size-3.5" /> Rotar
            </button>
          )}
          <button type="button" onClick={removeSelected} className="inline-flex items-center gap-1.5 text-ember hover:underline">
            <Trash2 className="size-3.5" /> Eliminar
          </button>
          <button type="button" onClick={() => setSelected(new Set(pages.map((p) => p.key)))} className="text-graphite hover:text-ink">Todas</button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-graphite hover:text-ink">Ninguna</button>
        </div>
      )}

      {loading && <p className="py-8 text-center font-mono text-sm text-graphite">Renderizando páginas…</p>}

      <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pages.map((page, index) => (
          <div
            key={page.key}
            className={`group relative overflow-hidden rounded-[var(--radius-instrument)] border bg-white ${selected.has(page.key) ? 'border-signal ring-2 ring-signal/30' : 'border-line'}`}
          >
            <div
              className="grid aspect-[3/4] cursor-pointer place-items-center overflow-hidden bg-paper-raised"
              onClick={(e) => clickSel(index, page.key, e.shiftKey)}
              title="Clic para seleccionar · Shift+clic para rango"
            >
              <img
                src={page.dataUrl}
                alt={`Página origen ${page.sourceIndex + 1}`}
                className="max-h-full max-w-full transition-transform"
                style={{ transform: `rotate(${page.rotation}deg)` }}
              />
            </div>

            <div className="flex items-center justify-between border-t border-line bg-paper-raised px-1.5 py-1">
              {focus === 'delete' ? (
                <span className="px-1 font-mono text-[10px] text-graphite">{page.sourceIndex + 1}</span>
              ) : (
                <span
                  className="drag-handle cursor-grab rounded p-1 text-graphite hover:text-ink active:cursor-grabbing"
                  aria-label="Arrastrar"
                >
                  <GripVertical className="size-4" />
                </span>
              )}
              {focus !== 'delete' && <span className="font-mono text-[10px] text-graphite">{page.sourceIndex + 1}</span>}
              <div className="flex items-center">
                {focus !== 'delete' && (
                  <button
                    type="button"
                    onClick={() => rotate(page.key)}
                    className="rounded p-1 text-graphite hover:bg-ink/5 hover:text-ink"
                    aria-label="Rotar 90°"
                  >
                    <RotateCw className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(page.key)}
                  className="rounded p-1 text-graphite hover:bg-ember/10 hover:text-ember"
                  aria-label="Eliminar página"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={run} loading={busy} disabled={pages.length === 0}>
        <Save className="size-4" aria-hidden />
        Guardar PDF
      </Button>
    </div>
  );
}
