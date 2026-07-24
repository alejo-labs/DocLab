import type { PDFPageProxy } from 'pdfjs-dist';
import { createPdfLoadingTask } from '../pdfjs';
import type { DocModel, Page, Block, Rect, Span } from './model';
import { pageSpans } from './extractSpans';
import { pageGraphics } from './extractGraphics';
import { assembleBlocks } from './assembleBlocks';
import { detectTables } from './detectTables';
import { detectTablesStream } from './detectTablesStream';
import { applyColors } from './extractColors';
import { contentBox } from './layout';
import { sanitizeSpans } from './util';
import { detectHeaderFooter } from './detectHeaderFooter';

function inside(cx: number, cy: number, r: Rect): boolean {
  return cx >= r.x - 2 && cx <= r.x + r.w + 2 && cy >= r.y - 2 && cy <= r.y + r.h + 2;
}

const clamp = (v: number, min: number, max: number): number => (Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min);

/** Alineación de una imagen respecto a la caja de contenido (left/center/right). */
function imageAlign(x: number, w: number, box: Rect): 'left' | 'center' | 'right' {
  if (box.w <= 0) return 'left';
  const left = x - box.x;
  const right = (box.x + box.w) - (x + w);
  const tol = Math.max(12, box.w * 0.05);
  if (Math.abs(left - right) < tol && left > tol) return 'center';
  if (right < tol && left > tol * 2) return 'right';
  return 'left';
}

/** Calcula el espaciado (pt) antes de cada bloque a partir del hueco con el anterior. */
function withSpacing(blocks: Block[]): Block[] {
  for (let i = 1; i < blocks.length; i += 1) {
    const prev = blocks[i - 1]!;
    const cur = blocks[i]!;
    const gap = cur.y - (prev.y + prev.h);
    if (gap > 2 && gap < 60) cur.spaceBefore = Math.round(gap);
  }
  return blocks;
}

/** Rango de páginas a procesar (1-based, inclusivo). Permite trocear documentos grandes. */
export interface PageRange { from: number; to: number }

/**
 * Análisis de layout completo de un PDF → DocModel (estructura). 100% en el navegador.
 * Texto siempre; tablas/imágenes de forma defensiva (un fallo no rompe el texto).
 * `range` limita las páginas procesadas (para documentos grandes).
 */
/** Opciones del análisis. `tables=false` → modo "texto limpio"; `ocr=true` → OCR de escaneados. */
export interface ExtractOptions { tables?: boolean; ocr?: boolean }

/** Renderiza una página y le aplica OCR → spans (para páginas escaneadas sin texto). */
async function ocrPage(page: PDFPageProxy): Promise<Span[]> {
  try {
    const scale = 2;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
    const { ocrImage } = await import('../ocr');
    const res = await ocrImage(canvas, 'spa+eng');
    // La altura del bbox de OCR incluye ascendentes/descendentes → el tamaño de fuente
    // real es ~0.72× (si no, el texto sale más grande que el original).
    return res.words.map((w) => { const h = (w.y1 - w.y0) / scale; return { text: w.text, x: w.x0 / scale, y: w.y0 / scale, w: (w.x1 - w.x0) / scale, h, fontSize: Math.max(6, h * 0.72), bold: false, italic: false, fontFamily: 'Helvetica' }; });
  } catch {
    return [];
  }
}

export async function extractStructure(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
  range?: PageRange,
  opts?: ExtractOptions,
): Promise<DocModel> {
  const wantTables = opts?.tables !== false;
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const pages: Page[] = [];
  try {
    const from = Math.max(1, Math.floor(range?.from ?? 1));
    const to = Math.min(pdf.numPages, Math.floor(range?.to ?? pdf.numPages));
    const total = Math.max(1, to - from + 1);
    let done = 0;
    for (let n = from; n <= to; n += 1) {
      let page: Awaited<ReturnType<typeof pdf.getPage>> | undefined;
      let W = 612;
      let H = 792;
      try {
        page = await pdf.getPage(n);
        const vp = page.getViewport({ scale: 1 });
        W = vp.width;
        H = vp.height;

        // Saneado: recorta posiciones/anchuras disparatadas a la página (evita márgenes
        // negativos que rompen Word) y descarta spans degenerados.
        let spans = sanitizeSpans(await pageSpans(page, H), W, H);
        // OCR de escaneados: si no hay texto real y se pidió OCR, reconocerlo.
        let ocrUsed = false;
        if (opts?.ocr && spans.reduce((s, sp) => s + sp.text.trim().length, 0) < 10) {
          const ocrSpans = await ocrPage(page);
          if (ocrSpans.length) { spans = ocrSpans; ocrUsed = true; }
        }
        if (!ocrUsed) { try { await applyColors(page, spans); } catch { /* sin color: negro por defecto */ } }
        let segments: Parameters<typeof detectTables>[0] = [];
        let imageModels: { x: number; y: number; w: number; h: number; bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' }[] = [];
        try {
          const g = await pageGraphics(page, H);
          imageModels = g.images;
          segments = g.segments;
        } catch { /* solo texto */ }

        // Modo Fiel: tablas con bordes (lattice) + sin bordes (stream). Modo Texto limpio
        // (wantTables=false): sin tablas, todo cae a párrafos/títulos/listas.
        let freeSpans = spans;
        let tableBlocks: Block[] = [];
        if (wantTables) {
          const lattice = detectTables(segments, spans);
          const afterLattice = spans.filter((s) => !lattice.regions.some((r) => inside(s.x + s.w / 2, s.y + s.h / 2, r)));
          const stream = detectTablesStream(afterLattice);
          freeSpans = afterLattice.filter((s) => !stream.regions.some((r) => inside(s.x + s.w / 2, s.y + s.h / 2, r)));
          tableBlocks = [...lattice.tables, ...stream.tables].map((t) => ({ kind: 'table', table: t.table, x: t.x, y: t.y, w: t.w, h: t.h }));
        }

        const cb = contentBox(spans);
        const textBlocks = assembleBlocks(freeSpans, W);
        const images: Block[] = imageModels.map((im) => ({ kind: 'image', image: im, x: im.x, y: im.y, w: im.w, h: im.h, align: imageAlign(im.x, im.w, cb) }));

        const blocks = tableBlocks.length === 0 && images.length === 0
          ? withSpacing(textBlocks)
          : withSpacing([...textBlocks, ...tableBlocks, ...images].sort((a, b) => a.y - b.y || a.x - b.x));

        const margin = {
          left: clamp(cb.x, 0, W),
          top: clamp(cb.y, 0, H),
          right: clamp(W - (cb.x + cb.w), 0, W),
          bottom: clamp(H - (cb.y + cb.h), 0, H),
        };
        pages.push({ width: W, height: H, margin, blocks });
      } catch {
        // Página problemática: se omite su contenido pero se conserva el hueco para no
        // abortar toda la conversión (red de seguridad).
        pages.push({ width: W, height: H, blocks: [] });
      } finally {
        page?.cleanup();
        onProgress?.((done += 1), total);
      }
    }
  } finally {
    await task.destroy();
  }
  const { header, footer } = detectHeaderFooter(pages);
  return { pages, ...(header ? { header } : {}), ...(footer ? { footer } : {}) };
}
