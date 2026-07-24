import { createPdfLoadingTask } from './pdfjs';

export type ImageFormat = 'png' | 'jpg';

export interface RenderedPage {
  pageNumber: number;
  blob: Blob;
  filename: string;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.'))),
      mime,
      quality,
    );
  });
}

/**
 * Renderiza cada página de un PDF a una imagen rasterizada (PNG o JPG) con pdf.js.
 * `scale` controla la resolución (2 ≈ 144 DPI, buena fidelidad). Llama a
 * `onProgress` por página para poder mostrar avance.
 */
export async function pdfToImages(
  bytes: Uint8Array,
  format: ImageFormat,
  scale = 2,
  onProgress?: (done: number, total: number) => void,
  pageNumbers?: number[],
): Promise<RenderedPage[]> {
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const results: RenderedPage[] = [];
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  // Páginas a renderizar (todas si no se especifica).
  const targets = pageNumbers && pageNumbers.length > 0
    ? pageNumbers.filter((n) => n >= 1 && n <= pdf.numPages)
    : Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  try {
    for (let idx = 0; idx < targets.length; idx += 1) {
      const pageNumber = targets[idx]!;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo crear el contexto de canvas.');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      // Fondo blanco para JPG (no soporta transparencia).
      if (format === 'jpg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await canvasToBlob(canvas, mime, format === 'jpg' ? 0.9 : undefined);
      page.cleanup();

      results.push({
        pageNumber,
        blob,
        filename: `pagina-${String(pageNumber).padStart(3, '0')}.${format}`,
      });
      onProgress?.(idx + 1, targets.length);
    }
  } finally {
    await task.destroy();
  }

  return results;
}
