import { createPdfLoadingTask } from './pdfjs';
import { alignParagraphs, type ParaDiff } from './wordDiff';

export type { DiffOp, DiffType, ParaDiff } from './wordDiff';

/** Extrae el texto de cada página AGRUPADO EN PÁRRAFOS (usando los saltos de línea de pdf.js). */
export async function extractPageParagraphs(bytes: Uint8Array): Promise<string[][]> {
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const out: string[][] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const paras: string[] = [];
      let para: string[] = [];
      let line = '';
      const endLine = () => {
        const t = line.replace(/\s+/g, ' ').trim();
        if (t) para.push(t);
        else if (para.length) { paras.push(para.join(' ')); para = []; }
        line = '';
      };
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        line += (it as { str: string }).str;
        if ((it as { hasEOL?: boolean }).hasEOL) endLine();
      }
      endLine();
      if (para.length) paras.push(para.join(' '));
      out.push(paras);
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

export interface PageComparison { page: number; paragraphs: ParaDiff[]; changed: boolean }

/** Compara dos PDF por su texto, página a página y párrafo a párrafo. */
export async function comparePdfs(aBytes: Uint8Array, bBytes: Uint8Array): Promise<PageComparison[]> {
  const [a, b] = await Promise.all([extractPageParagraphs(aBytes), extractPageParagraphs(bBytes)]);
  const pages = Math.max(a.length, b.length);
  const result: PageComparison[] = [];
  for (let p = 0; p < pages; p += 1) {
    const paragraphs = alignParagraphs(a[p] ?? [], b[p] ?? []);
    result.push({ page: p + 1, paragraphs, changed: paragraphs.some((x) => x.changed) });
  }
  return result;
}
