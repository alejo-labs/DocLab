import { createPdfLoadingTask } from './pdfjs';

/**
 * Extrae el texto de un PDF página a página con pdf.js. 100% en el navegador.
 * Devuelve el texto con saltos de página marcados.
 */
export async function extractText(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const chunks: string[] = [];

  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+\n/g, '\n')
        .trim();
      chunks.push(text);
      page.cleanup();
      onProgress?.(n, pdf.numPages);
    }
  } finally {
    await task.destroy();
  }

  return chunks
    .map((text, i) => `── Página ${i + 1} ──\n${text}`)
    .join('\n\n');
}
