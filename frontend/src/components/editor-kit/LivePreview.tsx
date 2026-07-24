import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { createPdfLoadingTask, renderPageThumbnail } from '../../lib/pdf/pdfjs';

interface PageInfo {
  dataUrl: string;
  width: number; // px renderizados
  height: number;
  pageCount: number;
}

/**
 * Previsualización en vivo: renderiza la primera página del PDF y deja superponer
 * una capa (overlay) que recibe las dimensiones en px para posicionar marcas de
 * agua, números de página, etc. Reutilizable por cualquier herramienta.
 */
export function LivePreview({ bytes, width = 280, page = 1, overlay }: { bytes: Uint8Array | null; width?: number; page?: number; overlay?: (dims: { width: number; height: number; pageCount: number }) => ReactNode }) {
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bytes) {
      setInfo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const task = createPdfLoadingTask(bytes);
    (async () => {
      try {
        const pdf = await task.promise;
        const n = Math.min(page, pdf.numPages);
        const t = await renderPageThumbnail(pdf, n, width);
        if (!cancelled) setInfo({ dataUrl: t.dataUrl, width: t.width, height: t.height, pageCount: pdf.numPages });
        await task.destroy();
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, width, page]);

  return (
    <div className="relative inline-block rounded-md border border-line bg-white shadow-sm" style={{ width: info?.width ?? width, minHeight: 80 }}>
      {info ? (
        <>
          <img src={info.dataUrl} alt="Vista previa" className="block w-full" />
          {overlay && (
            <div className="pointer-events-none absolute inset-0">{overlay({ width: info.width, height: info.height, pageCount: info.pageCount })}</div>
          )}
          <span className="absolute right-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-paper">Vista previa</span>
        </>
      ) : (
        <div className="grid h-40 place-items-center text-graphite">
          {loading ? <Loader2 className="size-5 animate-spin" /> : <span className="text-xs">Sin vista previa</span>}
        </div>
      )}
    </div>
  );
}
