import { useCallback, useEffect, useRef } from 'react';
import { createPdfLoadingTask, renderPageThumbnail } from './pdfjs';

type LoadedProxy = { task: ReturnType<typeof createPdfLoadingTask>; pdf: Awaited<ReturnType<typeof createPdfLoadingTask>['promise']> };

/**
 * Devuelve `renderPage(pageNumber)` para el lightbox: carga el PDF UNA sola vez y lo reutiliza
 * para todas las páginas, en lugar de re-parsear el documento en cada navegación. El proxy se
 * libera cuando `active` pasa a false (lightbox cerrado), al cambiar de documento o al desmontar.
 *
 * Devuelve el número de página (1-based) para que cada herramienta aplique su propio mapeo
 * (p. ej. Organizar reordena páginas y usa el índice de origen).
 */
export function useHdRenderer(bytes: Uint8Array | null, active: boolean, hdWidth = 900) {
  const proxyRef = useRef<Promise<LoadedProxy> | null>(null);

  const dispose = useCallback(() => {
    const pending = proxyRef.current;
    proxyRef.current = null;
    pending?.then(({ task }) => task.destroy()).catch(() => {});
  }, []);

  const renderPage = useCallback(async (pageNumber: number): Promise<string> => {
    if (!bytes) throw new Error('Datos no disponibles');
    if (!proxyRef.current) {
      const task = createPdfLoadingTask(bytes);
      proxyRef.current = task.promise.then((pdf) => ({ task, pdf }));
    }
    const { pdf } = await proxyRef.current;
    const thumb = await renderPageThumbnail(pdf, pageNumber, hdWidth);
    return thumb.dataUrl;
  }, [bytes, hdWidth]);

  // Libera el proxy al cerrar el lightbox o al cambiar de documento.
  useEffect(() => {
    if (!active) dispose();
  }, [active, bytes, dispose]);

  // Libera al desmontar.
  useEffect(() => dispose, [dispose]);

  return renderPage;
}
