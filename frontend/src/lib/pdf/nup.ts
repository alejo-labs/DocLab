import { PDFDocument, PDFName, type PDFEmbeddedPage } from 'pdf-lib';

/** Páginas por hoja admitidas. */
export type NupPerSheet = 2 | 4 | 6 | 9;
export interface NupOptions { perSheet: NupPerSheet; margin?: number; gap?: number }

// [columnas, filas] por valor; landscape cuando hay más columnas que filas.
const GRID: Record<NupPerSheet, [number, number]> = { 2: [2, 1], 4: [2, 2], 6: [2, 3], 9: [3, 3] };
const A4 = { w: 595.28, h: 841.89 };

/**
 * "N páginas por hoja" (N-up): coloca varias páginas del PDF en cada hoja A4, en
 * cuadrícula, escaladas a su celda. Ahorra papel para imprimir. 100% en el navegador.
 */
export async function nUpPdf(
  bytes: Uint8Array,
  options: NupOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const margin = options.margin ?? 24;
  const gap = options.gap ?? 12;
  const [cols, rows] = GRID[options.perSheet];
  const landscape = cols > rows;
  const sheetW = landscape ? A4.h : A4.w;
  const sheetH = landscape ? A4.w : A4.h;

  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  // Pre-filtramos las páginas embebibles: las que no tienen Contents (en blanco) no se
  // pueden embeber y romperían el guardado → dejan su celda vacía. (El embebido es
  // diferido al save, por eso hay que detectarlo antes, no con try/catch.)
  const pages = src.getPages();
  const embeds: (PDFEmbeddedPage | null)[] = pages.map(() => null);
  const embeddable = pages.map((p, i) => ({ p, i })).filter(({ p }) => !!p.node.get(PDFName.of('Contents')));
  if (embeddable.length) {
    const done = await out.embedPages(embeddable.map(({ p }) => p));
    embeddable.forEach(({ i }, j) => { embeds[i] = done[j]!; });
  }

  const cellW = (sheetW - 2 * margin - (cols - 1) * gap) / cols;
  const cellH = (sheetH - 2 * margin - (rows - 1) * gap) / rows;
  const perPage = cols * rows;
  const total = Math.max(1, Math.ceil(embeds.length / perPage));

  for (let s = 0; s < total; s += 1) {
    const sheet = out.addPage([sheetW, sheetH]);
    for (let k = 0; k < perPage; k += 1) {
      const idx = s * perPage + k;
      if (idx >= embeds.length) break;
      const e = embeds[idx];
      if (!e) continue; // página en blanco: celda vacía
      const col = k % cols;
      const row = Math.floor(k / cols);
      const scale = Math.min(cellW / e.width, cellH / e.height);
      const w = e.width * scale;
      const h = e.height * scale;
      const cellX = margin + col * (cellW + gap);
      const cellTopY = sheetH - margin - row * (cellH + gap);
      sheet.drawPage(e, { x: cellX + (cellW - w) / 2, y: cellTopY - cellH + (cellH - h) / 2, width: w, height: h });
    }
    onProgress?.(s + 1, total);
  }

  out.setProducer('DocLab');
  return out.save();
}
