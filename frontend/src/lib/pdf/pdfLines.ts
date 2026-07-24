import { createPdfLoadingTask } from './pdfjs';

/**
 * Reconstruye el texto de un PDF como LÍNEAS por página (agrupando los fragmentos
 * por su posición vertical). Base para PDF→Word (párrafos) y PDF→Excel (filas).
 * 100% en el navegador con pdf.js.
 */
export async function pdfToLines(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<string[][]> {
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const pages: string[][] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      // Agrupa por Y (redondeado) para reconstruir líneas; ordena por X dentro de cada línea.
      const rows = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue;
        const tr = (item as { transform: number[] }).transform;
        const x = tr[4] ?? 0;
        const y = Math.round((tr[5] ?? 0) / 2) * 2;
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ x, str: item.str });
      }
      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0]) // de arriba a abajo (Y mayor primero)
        .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.str).join('').replace(/\s+/g, ' ').trim())
        .filter((l) => l.length > 0);
      pages.push(lines);
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await task.destroy();
  }
  return pages;
}
