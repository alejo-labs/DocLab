import { useEffect, useRef, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import Sortable from 'sortablejs';
import { FileOutput, GripVertical, RotateCw, X } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { ThumbnailSizeBar, useThumbnailSize } from '../ThumbnailSizeBar';
import { PageLightbox, LightboxTrigger, type LightboxPage } from '../PageLightbox';
import { Segmented } from '../editor-kit/controls';
import { detectImageType, formatBytes, readFileBytes } from '../../lib/files';
import { imagesToPdf, type Orientation, type PageSize } from '../../lib/pdf/imagesToPdf';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import type { ToolEngineProps, ToolResult } from './types';

interface ImageItem {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  previewUrl: string;
  rotation: number;
}

const MARGINS = { none: 0, normal: 42.5, wide: 70.9 } as const;
type MarginKey = keyof typeof MARGINS;

export function ImagesToPdfTool(_props: ToolEngineProps) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<MarginKey>('normal');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  useReportProcessing(busy);
  useReportActiveDoc(items.length > 0);
  const gridRef = useRef<HTMLUListElement>(null);
  const { thumbSize, setThumbSize, gridStyle } = useThumbnailSize(items.length);

  useEffect(() => {
    return () => items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridRef.current || items.length === 0) return;
    const sortable = Sortable.create(gridRef.current, {
      animation: 160,
      handle: '.img-handle',
      ghostClass: 'opacity-40',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        setItems((prev) => {
          const next = [...prev];
          const [moved] = next.splice(oldIndex, 1);
          if (moved) next.splice(newIndex, 0, moved);
          return next;
        });
      },
    });
    return () => sortable.destroy();
  }, [items.length]);

  async function addFiles(files: File[]) {
    setError(null);
    const accepted: ImageItem[] = [];
    for (const file of files) {
      const bytes = await readFileBytes(file);
      if (!detectImageType(bytes)) {
        setError(`"${file.name}" no es una imagen JPG/PNG válida y se ha omitido.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size, bytes, previewUrl: URL.createObjectURL(new Blob([bytes.slice().buffer])), rotation: 0 });
    }
    setItems((prev) => [...prev, ...accepted]);
  }

  function rotate(id: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it)));
  }
  function remove(id: string) {
    setItems((prev) => {
      const t = prev.find((it) => it.id === id);
      if (t) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const pdf = await imagesToPdf(items.map((it) => ({ bytes: it.bytes, rotation: it.rotation })), { pageSize, orientation, margin: MARGINS[margin] });
      setResult({ bytes: pdf, filename: 'doclab-imagenes.pdf' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el PDF.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="images-to-pdf" onReset={() => { items.forEach((it) => URL.revokeObjectURL(it.previewUrl)); setItems([]); setResult(null); }} />;

  return (
    <div className="space-y-5">
      <FileDropzone accept="image/png,image/jpeg" multiple hint="Añade imágenes JPG o PNG. Arrástralas para ordenarlas; cada una será una página." onFiles={addFiles} />
      {error && <ErrorAlert message={error} />}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-graphite">Tamaño de página</p>
                <Segmented value={pageSize} onChange={setPageSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }, { value: 'fit', label: 'Ajustar' }]} />
              </div>
              {pageSize !== 'fit' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-graphite">Orientación</p>
                  <Segmented value={orientation} onChange={setOrientation} options={[{ value: 'auto', label: 'Auto' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} />
                </div>
              )}
              <div>
                <p className="mb-1.5 text-xs font-medium text-graphite">Márgenes</p>
                <Segmented value={margin} onChange={setMargin} options={[{ value: 'none', label: 'Sin' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Amplio' }]} />
              </div>
            </div>
            <ThumbnailSizeBar thumbSize={thumbSize} onChange={setThumbSize} />
          </div>

          <ul ref={gridRef} className="grid gap-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto p-1" style={gridStyle}>
            {items.map((it, index) => (
              <li key={it.id} className="group relative overflow-hidden rounded-[var(--radius-instrument)] border border-line bg-white">
                <div className="relative grid aspect-square place-items-center overflow-hidden bg-paper-raised">
                  <img src={it.previewUrl} alt={it.name} className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `rotate(${it.rotation}deg)` }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <LightboxTrigger onClick={() => setLightboxIndex(index)} />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-line bg-paper-raised px-1.5 py-1">
                  <span className="img-handle cursor-grab text-graphite active:cursor-grabbing" title="Arrastrar"><GripVertical className="size-3.5" /></span>
                  <span className="font-mono text-[10px] text-graphite">{index + 1} · {formatBytes(it.size)}</span>
                  <div className="flex items-center">
                    <button type="button" onClick={() => rotate(it.id)} className="rounded p-0.5 text-graphite hover:text-ink" aria-label="Rotar"><RotateCw className="size-3.5" /></button>
                    <button type="button" onClick={() => remove(it.id)} className="rounded p-0.5 text-graphite hover:text-ember" aria-label="Quitar"><X className="size-3.5" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {lightboxIndex !== null && (
            <PageLightbox
              pages={items.map((it): LightboxPage => ({ label: it.name, previewUrl: it.previewUrl }))}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
            />
          )}
        </>
      )}

      <Button onClick={run} loading={busy} disabled={items.length === 0}>
        <FileOutput className="size-4" aria-hidden />
        Crear PDF {items.length > 0 ? `(${items.length})` : ''}
      </Button>
    </div>
  );
}
