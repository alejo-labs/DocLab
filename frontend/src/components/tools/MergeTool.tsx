import { useCallback, useEffect, useRef, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import Sortable from 'sortablejs';
import { Combine, RotateCw, X } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { mergePages, type MergeSource } from '../../lib/pdf/merge';
import { createPdfLoadingTask, renderPageThumbnail } from '../../lib/pdf/pdfjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { takeHandoff } from '../../lib/handoff';
import type { ToolEngineProps, ToolResult } from './types';

interface Source extends MergeSource {
  name: string;
}
interface PageRef {
  id: string;
  fileId: string;
  name: string;
  pageIndex: number; // base 0
  rotation: number; // 0/90/180/270
}

const thumbKey = (fileId: string, pageIndex: number) => `${fileId}:${pageIndex}`;

export function MergeTool(_props: ToolEngineProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  const proxies = useRef<Map<string, { pdf: PDFDocumentProxy; task: ReturnType<typeof createPdfLoadingTask> }>>(new Map());
  const inflight = useRef<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);

  // Libera los workers de pdf.js al desmontar.
  useEffect(() => {
    const map = proxies.current;
    return () => { map.forEach((e) => e.task.destroy().catch(() => {})); map.clear(); };
  }, []);

  // Render perezoso de la miniatura de una página (solo cuando es visible).
  const ensureThumb = useCallback(async (fileId: string, pageIndex: number) => {
    const key = thumbKey(fileId, pageIndex);
    if (inflight.current.has(key)) return;
    const entry = proxies.current.get(fileId);
    if (!entry) return;
    inflight.current.add(key);
    try {
      const t = await renderPageThumbnail(entry.pdf, pageIndex + 1, 170);
      setThumbs((prev) => ({ ...prev, [key]: t.dataUrl }));
    } catch {
      /* miniatura opcional */
    } finally {
      inflight.current.delete(key);
    }
  }, []);

  async function addFiles(files: File[]) {
    setError(null);
    for (const file of files) {
      const bytes = await readFileBytes(file);
      if (!looksLikePdf(bytes)) {
        setError(`"${file.name}" no es un PDF válido y se ha omitido.`);
        continue;
      }
      const fileId = crypto.randomUUID();
      const task = createPdfLoadingTask(bytes);
      let pdf: PDFDocumentProxy;
      try {
        pdf = await task.promise;
      } catch {
        setError(`"${file.name}" está dañado o protegido y se ha omitido.`);
        await task.destroy().catch(() => {});
        continue;
      }
      proxies.current.set(fileId, { pdf, task });
      const newPages: PageRef[] = Array.from({ length: pdf.numPages }, (_, i) => ({
        id: crypto.randomUUID(), fileId, name: file.name, pageIndex: i, rotation: 0,
      }));
      setSources((prev) => [...prev, { fileId, name: file.name, bytes }]);
      setPages((prev) => [...prev, ...newPages]);
    }
  }

  useEffect(() => {
    const h = takeHandoff();
    if (h) addFiles([new File([h.bytes as BlobPart], h.filename, { type: 'application/pdf' })]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reordenar arrastrando (a nivel de página, entre y dentro de documentos).
  useEffect(() => {
    if (!listRef.current || pages.length === 0) return;
    const sortable = Sortable.create(listRef.current, {
      animation: 160,
      handle: '.page-handle',
      filter: 'button',
      preventOnFilter: false,
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
  }, [pages.length]);

  function rotate(id: string) {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  }
  function removePage(id: string) {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      // Si un documento se queda sin páginas, libera su proxy y origen.
      const removed = prev.find((p) => p.id === id);
      if (removed && !next.some((p) => p.fileId === removed.fileId)) {
        proxies.current.get(removed.fileId)?.task.destroy().catch(() => {});
        proxies.current.delete(removed.fileId);
        setSources((s) => s.filter((src) => src.fileId !== removed.fileId));
      }
      return next;
    });
  }
  function clearAll() {
    proxies.current.forEach((e) => e.task.destroy().catch(() => {}));
    proxies.current.clear();
    setSources([]);
    setPages([]);
    setThumbs({});
  }

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const merged = await mergePages(
        sources.map((s) => ({ fileId: s.fileId, bytes: s.bytes })),
        pages.map((p) => ({ fileId: p.fileId, pageIndex: p.pageIndex, rotation: p.rotation })),
      );
      setResult({ bytes: merged, filename: 'doclab-unido.pdf' });
    } catch {
      setError('No se pudieron unir los PDF. ¿Alguno está dañado o protegido?');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="merge" onReset={() => { setResult(null); clearAll(); }} />;

  const totalSize = sources.reduce((s, it) => s + it.bytes.length, 0);

  return (
    <div className="space-y-5">
      <FileDropzone accept="application/pdf" multiple hint="Añade dos o más PDF. Arrastra las páginas para ordenarlas, rótalas o quítalas; se unirán en ese orden." onFiles={addFiles} />
      {error && <ErrorAlert message={error} />}

      {pages.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-graphite">{pages.length} página{pages.length > 1 ? 's' : ''} · {sources.length} documento{sources.length > 1 ? 's' : ''} · {formatBytes(totalSize)}</p>
            <button type="button" onClick={clearAll} className="text-sm text-graphite hover:text-ink">Vaciar todo</button>
          </div>

          <ul ref={listRef} className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-3">
            {pages.map((p, index) => (
              <PageCard
                key={p.id}
                page={p}
                index={index}
                thumb={thumbs[thumbKey(p.fileId, p.pageIndex)]}
                onVisible={() => ensureThumb(p.fileId, p.pageIndex)}
                onRotate={() => rotate(p.id)}
                onRemove={() => removePage(p.id)}
              />
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy} disabled={pages.length < 2}><Combine className="size-4" aria-hidden /> Unir {pages.length > 0 ? `${pages.length} páginas` : 'PDF'}</Button>
      </div>
    </div>
  );
}

interface PageCardProps {
  page: PageRef;
  index: number;
  thumb?: string;
  onVisible: () => void;
  onRotate: () => void;
  onRemove: () => void;
}
function PageCard({ page, index, thumb, onVisible, onRotate, onRemove }: PageCardProps) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (thumb) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { onVisible(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [thumb, onVisible]);

  return (
    <li ref={ref} data-id={page.id} className="page-handle group relative cursor-grab rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-1.5 active:cursor-grabbing">
      <span className="absolute left-1 top-1 z-10 grid size-5 place-items-center rounded bg-ink/75 font-mono text-[10px] text-paper">{index + 1}</span>
      <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={onRotate} className="grid size-5 place-items-center rounded bg-paper/90 text-graphite shadow-sm hover:text-signal-deep" aria-label="Rotar"><RotateCw className="size-3" /></button>
        <button type="button" onClick={onRemove} className="grid size-5 place-items-center rounded bg-paper/90 text-graphite shadow-sm hover:text-ember" aria-label="Quitar"><X className="size-3" /></button>
      </div>
      <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded bg-white">
        {thumb ? (
          <img src={thumb} alt={`Página ${page.pageIndex + 1} de ${page.name}`} className="max-h-full max-w-full select-none object-contain transition-transform" style={{ transform: `rotate(${page.rotation}deg)` }} draggable={false} />
        ) : (
          <span className="size-4 animate-pulse rounded-full bg-line" />
        )}
      </div>
      <p className="mt-1 truncate font-mono text-[10px] text-graphite" title={`${page.name} · pág. ${page.pageIndex + 1}`}>{page.name}</p>
    </li>
  );
}
