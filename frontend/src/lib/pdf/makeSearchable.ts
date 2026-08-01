import { PDFDocument, StandardFonts, TextRenderingMode, rgb, setTextRenderingMode } from 'pdf-lib';
import { createPdfLoadingTask } from './pdfjs';
import { renderPageToCanvas, canvasToJpeg } from './renderPage';
import { ocrImage, type OcrLang } from './ocr';

export interface SearchableResult { bytes: Uint8Array; text: string }

/** Fase de la que informa el motor: `preparing` = cargando modelo (1ª vez), `recognizing` = leyendo. */
export type OcrPhase = 'preparing' | 'recognizing';

export interface MakeSearchableOptions {
  onProgress?: (page: number, total: number, ocr: number) => void;
  /** Cambio de fase (para avisar de la carga inicial del modelo, que tarda). */
  onPhase?: (phase: OcrPhase) => void;
  /** Cancelación cooperativa: se comprueba entre páginas (aborta al terminar la página en curso). */
  signal?: AbortSignal;
}

/**
 * OCR de un PDF (escaneado) → PDF **buscable**: cada página se conserva como imagen y se le
 * añade una **capa de texto invisible** (Tr=3) con las palabras reconocidas en su posición,
 * de modo que el resultado es seleccionable y buscable. 100% en el navegador (tesseract.js).
 */
export async function makeSearchablePdf(
  bytes: Uint8Array,
  lang: OcrLang = 'spa+eng',
  options: MakeSearchableOptions = {},
): Promise<SearchableResult> {
  const { onProgress, onPhase, signal } = options;
  const abortIfRequested = () => { if (signal?.aborted) throw new DOMException('OCR cancelado por el usuario.', 'AbortError'); };
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const out = await PDFDocument.create();
  const helv = await out.embedFont(StandardFonts.Helvetica);
  const total = pdf.numPages;
  let allText = '';
  onPhase?.('preparing'); // hasta que llegue el primer progreso de reconocimiento
  try {
    for (let n = 1; n <= total; n += 1) {
      abortIfRequested();
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const W = base.width;
      const H = base.height;
      const scale = 2;
      const canvas = await renderPageToCanvas(page, scale);
      page.cleanup();

      const ocr = await ocrImage(
        canvas,
        lang,
        (p) => { onPhase?.('recognizing'); onProgress?.(n, total, p); },
        () => onPhase?.('preparing'),
      );
      abortIfRequested();
      allText += `${ocr.text}\n\n`;

      const emb = await out.embedJpg(await canvasToJpeg(canvas));
      const np = out.addPage([W, H]);
      np.drawImage(emb, { x: 0, y: 0, width: W, height: H });

      np.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
      for (const w of ocr.words) {
        const x = w.x0 / scale;
        const hpx = (w.y1 - w.y0) / scale;
        const fs = Math.max(4, hpx * 0.72); // alto del bbox incluye ascendentes/descendentes
        const yBaseline = H - (w.y0 / scale + hpx * 0.85);
        try { np.drawText(w.text, { x, y: yBaseline, size: fs, font: helv, color: rgb(0, 0, 0) }); } catch { /* glifo no representable */ }
      }
      np.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
    }
    out.setProducer('DocLab');
    return { bytes: await out.save(), text: allText.trim() };
  } finally {
    await task.destroy();
  }
}
