import { extractStructure, type PageRange } from './structure/extractStructure';
import { docModelToWord } from './docModelToWord';

/** Modo de conversión: 'faithful' reconstruye tablas/maquetación; 'clean' = flujo de texto robusto. */
export type WordMode = 'faithful' | 'clean';

/**
 * PDF → Word (.docx). Dos modos:
 * - 'faithful': reconstruye títulos, párrafos, listas, TABLAS, imágenes y maquetación.
 * - 'clean': flujo de texto robusto (sin tablas) — casi siempre se ve bien en PDF complejos.
 * 100% on-device.
 */
export async function pdfToWord(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
  range?: PageRange,
  mode: WordMode = 'faithful',
  ocr = false,
): Promise<Blob> {
  const doc = await extractStructure(bytes, onProgress, range, { tables: mode !== 'clean', ocr });
  return docModelToWord(doc);
}
