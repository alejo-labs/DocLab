import { createPdfLoadingTask } from './pdfjs';

/** Posición de un widget de campo, en puntos de página con origen arriba-izquierda. */
export interface WidgetRect {
  name: string;
  page: number; // base 0
  x: number;
  y: number;
  width: number;
  height: number;
  /** valor de exportación de la opción (radio/checkbox) para distinguir widgets del mismo grupo */
  exportValue?: string;
}

/**
 * Lee la geometría de los campos de formulario con pdf.js (`getAnnotations`), para
 * poder superponer inputs editables sobre la imagen renderizada de cada página.
 * 100% en el navegador.
 */
export async function readWidgetRects(bytes: Uint8Array): Promise<WidgetRect[]> {
  const task = createPdfLoadingTask(bytes);
  const out: WidgetRect[] = [];
  try {
    const pdf = await task.promise;
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;
      const annots = await page.getAnnotations();
      for (const a of annots as Array<Record<string, unknown>>) {
        if (a.subtype !== 'Widget' || typeof a.fieldName !== 'string') continue;
        const rect = a.rect as number[] | undefined;
        if (!rect || rect.length < 4) continue;
        const x1 = Math.min(rect[0]!, rect[2]!);
        const x2 = Math.max(rect[0]!, rect[2]!);
        const y1 = Math.min(rect[1]!, rect[3]!);
        const y2 = Math.max(rect[1]!, rect[3]!);
        out.push({
          name: a.fieldName,
          page: n - 1,
          x: x1,
          y: pageHeight - y2,
          width: x2 - x1,
          height: y2 - y1,
          exportValue: typeof a.buttonValue === 'string' ? a.buttonValue : undefined,
        });
      }
    }
  } finally {
    task.destroy();
  }
  return out;
}
