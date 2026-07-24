import { useEffect, useState } from 'react';
import { createPdfLoadingTask, renderPageThumbnail, type PageThumbnail } from './pdfjs';

interface ThumbnailState {
  thumbnails: PageThumbnail[];
  pageCount: number;
  loading: boolean;
  error: string | null;
}

/**
 * Renderiza progresivamente las miniaturas de todas las páginas de un PDF.
 * Cancela de forma segura si el componente se desmonta o cambian los bytes.
 */
export function usePdfThumbnails(bytes: Uint8Array | null, width = 220): ThumbnailState {
  const [state, setState] = useState<ThumbnailState>({
    thumbnails: [],
    pageCount: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!bytes) {
      setState({ thumbnails: [], pageCount: 0, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ thumbnails: [], pageCount: 0, loading: true, error: null });

    const task = createPdfLoadingTask(bytes);

    (async () => {
      try {
        const pdf = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }
        setState((prev) => ({ ...prev, pageCount: pdf.numPages }));

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const thumb = await renderPageThumbnail(pdf, pageNumber, width);
          if (cancelled) break;
          setState((prev) => ({ ...prev, thumbnails: [...prev.thumbnails, thumb] }));
        }

        await task.destroy();
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      } catch {
        if (!cancelled) {
          setState({
            thumbnails: [],
            pageCount: 0,
            loading: false,
            error: 'No se pudo leer el PDF. ¿Está dañado o protegido con contraseña?',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes, width]);

  return state;
}
