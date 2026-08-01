import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Check, Scissors } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { ThumbnailSizeBar, useThumbnailSize } from '../ThumbnailSizeBar';
import { PageLightbox, LightboxTrigger, type LightboxPage } from '../PageLightbox';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { usePdfThumbnails } from '../../lib/pdf/usePdfThumbnails';
import { createPdfLoadingTask, renderPageThumbnail } from '../../lib/pdf/pdfjs';
import { extractPages, parsePageRanges } from '../../lib/pdf/split';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import type { ToolEngineProps, ToolResult } from './types';

export function SplitTool({ preset }: ToolEngineProps) {
  const isExtract = preset?.mode === 'extract';
  const verb = isExtract ? 'Extraer' : 'Dividir';

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState('');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  useReportProcessing(busy);
  useReportActiveDoc(!!bytes);

  const { thumbnails, pageCount, loading, error: loadError } = usePdfThumbnails(bytes);
  const selectedCount = selected.size;
  const orderedSelection = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const { thumbSize, setThumbSize, gridStyle } = useThumbnailSize(thumbnails.length);

  // Encadenado desde otra herramienta.
  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) {
      setFileName(stripExtension(handoff.filename));
      setBytes(handoff.bytes);
    }
  }, []);

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
    setSelected(new Set());
    setRangeText('');
    setBytes(data);
  }

  const lastIndex = useRef<number | null>(null);
  function clickPage(index: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastIndex.current !== null) {
        // Selecciona el rango entre el último clic y este (estilo explorador).
        const [a, b] = [lastIndex.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i += 1) next.add(i);
      } else if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    lastIndex.current = index;
  }
  function invert() {
    setSelected((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < pageCount; i += 1) if (!prev.has(i)) next.add(i);
      return next;
    });
  }

  function applyRange() {
    setError(null);
    try {
      setSelected(new Set(parsePageRanges(rangeText, pageCount)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rango inválido.');
    }
  }

  function reset() {
    setBytes(null);
    setResult(null);
    setSelected(new Set());
    setRangeText('');
    setLightboxIndex(null);
  }

  // ── Lightbox HD: crea tarea temporal desde bytes ──
  const renderHd = useCallback(async (idx: number) => {
    if (!bytes) throw new Error('Datos no disponibles');
    const task = createPdfLoadingTask(bytes);
    try {
      const pdf = await task.promise;
      const thumb = await renderPageThumbnail(pdf, idx + 1, 900);
      await task.destroy();
      return thumb.dataUrl;
    } catch {
      await task.destroy().catch(() => {});
      throw new Error('No se pudo renderizar');
    }
  }, [bytes]);

  const lightboxPages: LightboxPage[] = thumbnails.map((t) => ({
    label: `Página ${t.pageNumber}`,
    previewUrl: t.dataUrl,
  }));

  async function run() {
    if (!bytes) return;
    setError(null);
    setBusy(true);
    try {
      const out = await extractPages(bytes, orderedSelection);
      setResult({ bytes: out, filename: `${fileName}-${isExtract ? 'extraido' : 'dividido'}.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la selección.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return <ResultPreview result={result} currentEngine="split" onReset={reset} />;
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone
          accept="application/pdf"
          hint={
            isExtract
              ? 'Sube un PDF y selecciona las páginas que quieres extraer a un nuevo documento.'
              : 'Sube un PDF y elige las páginas o rangos que formarán el nuevo documento.'
          }
          onFiles={onFile}
        />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || loadError) && <ErrorAlert message={error ?? loadError!} />}

      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-3">
        <div className="flex items-center gap-2">
          <input
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyRange()}
            placeholder="Rangos: 1-3, 5, 8"
            className="w-44 rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
          />
          <Button variant="ghost" onClick={applyRange}>
            Aplicar
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThumbnailSizeBar thumbSize={thumbSize} onChange={setThumbSize} />
          <button
            type="button"
            onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
            className="text-graphite hover:text-ink"
          >
            Todas
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-graphite hover:text-ink">
            Ninguna
          </button>
          <button type="button" onClick={invert} className="text-graphite hover:text-ink">
            Invertir
          </button>
          <span className="font-mono text-xs text-signal-deep">{selectedCount} seleccionadas</span>
        </div>
      </div>

      {loading && thumbnails.length === 0 && (
        <p className="py-8 text-center font-mono text-sm text-graphite">Renderizando páginas…</p>
      )}

      <div className="grid gap-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto p-1" style={gridStyle}>
        {thumbnails.map((thumb) => {
          const index = thumb.pageNumber - 1;
          const isSelected = selected.has(index);
          return (
            <button
              type="button"
              key={thumb.pageNumber}
              onClick={(e) => clickPage(index, e.shiftKey)}
              className={`group relative overflow-hidden rounded-[var(--radius-instrument)] border-2 bg-white transition-all ${
                isSelected ? 'border-signal shadow-[0_0_0_3px_rgba(15,181,166,0.15)]' : 'border-line hover:border-signal/50'
              }`}
              aria-pressed={isSelected}
            >
              <img src={thumb.dataUrl} alt={`Página ${thumb.pageNumber}`} className="w-full" />
              <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] text-paper">
                {thumb.pageNumber}
              </span>
              {isSelected && (
                <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-signal text-white">
                  <Check className="size-3.5" />
                </span>
              )}
              {/* Overlay de zoom en el centro */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                <LightboxTrigger onClick={() => setLightboxIndex(index)} />
              </div>
            </button>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <PageLightbox
          pages={lightboxPages}
          initialIndex={lightboxIndex}
          renderHd={renderHd}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy} disabled={selectedCount === 0}>
          <Scissors className="size-4" aria-hidden />
          {verb} {selectedCount > 0 ? `${selectedCount} página${selectedCount > 1 ? 's' : ''}` : 'selección'}
        </Button>
        <button type="button" onClick={reset} className="text-sm text-graphite hover:text-ink">
          Cambiar archivo
        </button>
      </div>
    </div>
  );
}
