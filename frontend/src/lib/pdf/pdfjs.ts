import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// El worker se sirve desde el propio bundle (cero peticiones a CDNs externas).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  /** Escala px/punto usada (para superponer capas al tamaño correcto en cualquier página). */
  scale: number;
}

/**
 * Crea una tarea de carga de pdf.js. Trabaja sobre una COPIA de los bytes porque
 * pdf.js transfiere (detacha) el ArrayBuffer que recibe. Usa `task.destroy()`
 * para liberar el worker cuando termines.
 */
export function createPdfLoadingTask(bytes: Uint8Array) {
  const copy = bytes.slice();
  return pdfjsLib.getDocument({ data: copy });
}

/** Renderiza una página a un data URL PNG para usar como miniatura/preview. */
export async function renderPageThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 220,
): Promise<PageThumbnail> {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo crear el contexto de canvas.');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  page.cleanup();

  return { pageNumber, dataUrl, width: canvas.width, height: canvas.height, scale: canvas.width / baseViewport.width };
}

/** Número de páginas de un PDF (vía pdf.js, ligero). */
export async function getPageCount(bytes: Uint8Array): Promise<number> {
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const count = pdf.numPages;
  await task.destroy();
  return count;
}
