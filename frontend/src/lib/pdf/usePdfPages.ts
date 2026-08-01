import { useEffect, useState } from 'react';
import { createPdfLoadingTask, renderPageThumbnail } from './pdfjs';

export interface EditorPage {
  pageNumber: number; // base 1
  dataUrl: string;
  /** Dimensiones reales en puntos PDF (escala 1). */
  widthPt: number;
  heightPt: number;
  /** Factor px-pantalla / punto-PDF para esta página. */
  displayScale: number;
}

interface PagesState {
  pages: EditorPage[];
  loading: boolean;
  error: string | null;
}

/**
 * Renderiza todas las páginas a tamaño de edición (ajustadas a `targetWidth` px de
 * ancho). Reutiliza el render de pdf.js. Cancela de forma segura al desmontar.
 */
export function usePdfPages(bytes: Uint8Array | null, targetWidth = 820): PagesState {
  const [state, setState] = useState<PagesState>({ pages: [], loading: false, error: null });

  useEffect(() => {
    if (!bytes) {
      setState({ pages: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ pages: [], loading: true, error: null });
    const task = createPdfLoadingTask(bytes);

    (async () => {
      try {
        const pdf = await task.promise;
        const collected: EditorPage[] = [];
        // Sobre-muestreo para nitidez retina y margen de zoom: renderizamos a más
        // resolución de la que se muestra (la imagen se reduce al pintarla → nítida).
        const oversample = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2);
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const displayScale = Math.min(targetWidth / base.width, 2);
          // Ancho de render = ancho mostrado × sobre-muestreo, acotado para no agotar memoria.
          const renderPx = Math.min(Math.round(base.width * displayScale * oversample), 2600);
          const rendered = await renderPageThumbnail(pdf, n, renderPx);
          if (cancelled) break;
          collected.push({
            pageNumber: n,
            dataUrl: rendered.dataUrl,
            widthPt: base.width,
            heightPt: base.height,
            displayScale,
          });
          setState((prev) => ({ ...prev, pages: [...collected] }));
        }
        await task.destroy();
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      } catch {
        if (!cancelled) {
          setState({ pages: [], loading: false, error: 'No se pudo abrir el PDF para editar.' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes, targetWidth]);

  return state;
}
