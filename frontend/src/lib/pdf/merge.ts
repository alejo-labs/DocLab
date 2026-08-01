import { PDFDocument, PDFPage, degrees } from 'pdf-lib';

/**
 * Une varios PDF (en el orden dado) en un único documento. Todo en memoria del
 * navegador — ningún byte sale del dispositivo.
 */
export async function mergePdfs(sources: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  for (const bytes of sources) {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const page of copied) {
      out.addPage(page);
    }
  }

  out.setProducer('DocLab');
  out.setCreator('DocLab');
  return out.save();
}

/** Un documento de origen identificado, para uniones a nivel de página. */
export interface MergeSource {
  fileId: string;
  bytes: Uint8Array;
}

/** Una página concreta a incluir en el resultado, en el orden del array. */
export interface MergePageRef {
  fileId: string;
  pageIndex: number;
  /** rotación adicional del usuario (0/90/180/270), sobre la del documento original */
  rotation?: number;
}

/**
 * Une PÁGINAS sueltas de varios PDF en el orden indicado, aplicando la rotación de
 * cada una. Deduplica recursos copiando, por documento, todos sus índices usados de
 * una sola vez (copiarlos de a uno duplicaría fuentes/imágenes compartidas).
 */
export async function mergePages(sources: MergeSource[], order: MergePageRef[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const byId = new Map(sources.map((s) => [s.fileId, s]));

  // Índices únicos solicitados por documento (preservando el primer orden de aparición).
  const neededByFile = new Map<string, number[]>();
  for (const ref of order) {
    const list = neededByFile.get(ref.fileId) ?? [];
    if (!list.includes(ref.pageIndex)) list.push(ref.pageIndex);
    neededByFile.set(ref.fileId, list);
  }

  // Copia por documento (una llamada → dedup de recursos). Mapa (fileId:idx) → página copiada.
  const copiedMap = new Map<string, PDFPage>();
  for (const [fileId, indices] of neededByFile) {
    const source = byId.get(fileId);
    if (!source) continue;
    const src = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
    const valid = indices.filter((i) => i >= 0 && i < src.getPageCount());
    const copied = await out.copyPages(src, valid);
    valid.forEach((idx, k) => copiedMap.set(`${fileId}:${idx}`, copied[k]!));
  }

  // Añade en el orden final, con la rotación del usuario sumada a la del original.
  for (const ref of order) {
    const page = copiedMap.get(`${ref.fileId}:${ref.pageIndex}`);
    if (!page) continue;
    if (ref.rotation) {
      const base = page.getRotation().angle;
      page.setRotation(degrees((base + ref.rotation) % 360));
    }
    out.addPage(page);
  }

  out.setProducer('DocLab');
  out.setCreator('DocLab');
  return out.save();
}
