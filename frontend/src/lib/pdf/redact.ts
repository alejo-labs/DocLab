import { PDFDocument, StandardFonts, TextRenderingMode, rgb, setTextRenderingMode } from 'pdf-lib';
import { createPdfLoadingTask } from './pdfjs';
import { renderPageToCanvas, canvasToJpeg } from './renderPage';

/** Caja a censurar, en PUNTOS de página, origen arriba-izquierda. */
export interface RedactBox { page: number; x: number; y: number; w: number; h: number }
export type RedactStyle = 'black' | 'white';

/** ¿El centro de un fragmento de texto cae dentro de alguna caja? (coords top-left de página). */
export function itemRedacted(cxTop: number, cyTop: number, boxes: RedactBox[]): boolean {
  return boxes.some((b) => cxTop >= b.x && cxTop <= b.x + b.w && cyTop >= b.y && cyTop <= b.y + b.h);
}

/**
 * Redacción REAL que PRESERVA el resto del texto: las páginas con cajas se rasterizan con
 * las zonas tapadas (negro/blanco) — así el texto censurado DESAPARECE — y encima se vuelve
 * a colocar el texto NO censurado como capa invisible (modo Tr=3), de modo que el resto de
 * la página sigue siendo seleccionable y buscable. Las páginas sin cajas se conservan intactas.
 */
export async function redactPdf(
  bytes: Uint8Array,
  boxes: RedactBox[],
  style: RedactStyle = 'black',
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const byPage = new Map<number, RedactBox[]>();
  for (const b of boxes) { const l = byPage.get(b.page) ?? []; l.push(b); byPage.set(b.page, l); }

  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const helv = await out.embedFont(StandardFonts.Helvetica);
  const total = pdf.numPages;
  try {
    const keptIdx: number[] = [];
    for (let i = 0; i < total; i += 1) if (!byPage.has(i)) keptIdx.push(i);
    const copied = keptIdx.length ? await out.copyPages(src, keptIdx) : [];
    const copiedByIdx = new Map<number, (typeof copied)[number]>();
    keptIdx.forEach((idx, k) => copiedByIdx.set(idx, copied[k]!));

    let done = 0;
    for (let n = 1; n <= total; n += 1) {
      const idx = n - 1;
      if (!byPage.has(idx)) { out.addPage(copiedByIdx.get(idx)!); onProgress?.((done += 1), total); continue; }

      const pageBoxes = byPage.get(idx)!;
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const W = base.width;
      const H = base.height;

      // 1) Rasterizar la página con las zonas tapadas (el texto debajo desaparece).
      const scale = 2;
      const canvas = await renderPageToCanvas(page, scale);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = style === 'white' ? '#ffffff' : '#000000';
      for (const b of pageBoxes) ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
      const jpg = await canvasToJpeg(canvas);

      // 2) Texto NO censurado para la capa invisible (antes de cleanup).
      const tc = await page.getTextContent();
      page.cleanup();

      const emb = await out.embedJpg(jpg);
      const np = out.addPage([W, H]);
      np.drawImage(emb, { x: 0, y: 0, width: W, height: H });

      // 3) Capa de texto invisible (Tr=3) → seleccionable salvo lo censurado.
      np.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        const item = it as { str: string; width: number; transform: number[] };
        if (!item.str.trim()) continue;
        const tr = item.transform;
        const fs = Math.hypot(tr[2] ?? 0, tr[3] ?? 0) || 10;
        const xLeft = tr[4] ?? 0;
        const yBaseline = tr[5] ?? 0;
        const cxTop = xLeft + (item.width || 0) / 2;
        const cyTop = H - (yBaseline + fs * 0.3);
        if (itemRedacted(cxTop, cyTop, pageBoxes)) continue; // censurado: no re-añadir
        try { np.drawText(item.str, { x: xLeft, y: yBaseline, size: fs, font: helv, color: rgb(0, 0, 0) }); } catch { /* glifo no representable: omitir */ }
      }
      np.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
      onProgress?.((done += 1), total);
    }
    out.setProducer('DocLab');
    return out.save();
  } finally {
    await task.destroy();
  }
}
