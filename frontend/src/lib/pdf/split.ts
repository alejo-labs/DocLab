import { PDFDocument } from 'pdf-lib';

/**
 * Crea un nuevo PDF con SOLO las páginas indicadas (índices base 0, en el orden
 * dado). Usado para extraer una selección a un único documento.
 */
export async function extractPages(bytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
  if (pageIndices.length === 0) {
    throw new Error('Selecciona al menos una página.');
  }
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageIndices);
  for (const page of copied) {
    out.addPage(page);
  }
  out.setProducer('DocLab');
  return out.save();
}

/**
 * Parsea una expresión de rangos tipo "1-3, 5, 8-10" a índices base 0, validados
 * contra el número total de páginas. Lanza si la expresión es inválida.
 */
export function parsePageRanges(expression: string, pageCount: number): number[] {
  const indices = new Set<number>();
  const parts = expression
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Introduce un rango de páginas, p. ej. 1-3, 5.');
  }

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end > pageCount || start > end) {
        throw new Error(`Rango fuera de límites: "${part}" (el documento tiene ${pageCount} páginas).`);
      }
      for (let page = start; page <= end; page += 1) {
        indices.add(page - 1);
      }
    } else if (singleMatch) {
      const page = Number(singleMatch[1]);
      if (page < 1 || page > pageCount) {
        throw new Error(`Página fuera de límites: "${part}" (el documento tiene ${pageCount} páginas).`);
      }
      indices.add(page - 1);
    } else {
      throw new Error(`Expresión inválida: "${part}". Usa números y rangos, p. ej. 1-3, 5.`);
    }
  }

  return [...indices].sort((a, b) => a - b);
}
