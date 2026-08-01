import { createWorker, type Worker } from 'tesseract.js';

/** Assets de tesseract autoalojados en `public/tesseract/` (cumple CSP `'self'`). */
const BASE = '/tesseract';
export type OcrLang = 'spa' | 'eng' | 'spa+eng';

export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number }
export interface OcrResult { text: string; words: OcrWord[] }

let workerPromise: Promise<Worker> | null = null;
let workerLang = '';
let progressCb: ((p: number) => void) | undefined;
let statusCb: ((status: string) => void) | undefined;

async function getWorker(lang: OcrLang): Promise<Worker> {
  if (!workerPromise || workerLang !== lang) {
    if (workerPromise) { workerPromise.then((w) => w.terminate()).catch(() => {}); }
    workerLang = lang;
    workerPromise = createWorker(lang, 1 /* OEM LSTM */, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: `${BASE}/`,
      langPath: `${BASE}/lang`,
      workerBlobURL: false,
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') progressCb?.(m.progress);
        else if (m.status) statusCb?.(m.status); // carga del motor/idioma (primera vez)
      },
    });
  }
  return workerPromise;
}

/**
 * OCR de una imagen (canvas/dataURL/Blob) → texto + palabras con bbox (px de la imagen).
 * `onStatus` recibe los estados de preparación del motor (carga de núcleo/idioma), útiles
 * para avisar en la primera ejecución de que descargar el modelo tarda.
 */
export async function ocrImage(
  image: HTMLCanvasElement | string | Blob,
  lang: OcrLang = 'spa+eng',
  onProgress?: (p: number) => void,
  onStatus?: (status: string) => void,
): Promise<OcrResult> {
  progressCb = onProgress;
  statusCb = onStatus;
  const worker = await getWorker(lang);
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
  const words: OcrWord[] = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs)
    .flatMap((p) => p.lines)
    .flatMap((l) => l.words)
    .filter((w) => w.text.trim())
    .map((w) => ({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }));
  return { text: data.text, words };
}

/** Libera el worker de OCR. */
export async function terminateOcr(): Promise<void> {
  if (workerPromise) { try { (await workerPromise).terminate(); } catch { /* ya cerrado */ } workerPromise = null; }
}
