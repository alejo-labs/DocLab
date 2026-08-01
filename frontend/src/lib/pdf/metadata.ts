import { PDFDocument } from 'pdf-lib';

export interface PdfMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export interface PdfInfo {
  creator: string;
  producer: string;
  created: string;
  modified: string;
  pages: number;
}

function fmtDate(d: Date | undefined): string {
  if (!d) return '—';
  try {
    return d.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Información de solo lectura del PDF (no editable con pdf-lib). */
export async function readInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const doc = await PDFDocument.load(bytes);
  let created: Date | undefined;
  let modified: Date | undefined;
  try { created = doc.getCreationDate(); } catch { /* opcional */ }
  try { modified = doc.getModificationDate(); } catch { /* opcional */ }
  return {
    creator: doc.getCreator() ?? '—',
    producer: doc.getProducer() ?? '—',
    created: fmtDate(created),
    modified: fmtDate(modified),
    pages: doc.getPageCount(),
  };
}

/** Lee los metadatos editables de un PDF. */
export async function readMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  const doc = await PDFDocument.load(bytes);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() ?? '').toString(),
  };
}

/** Escribe los metadatos (los campos vacíos se limpian). */
export async function writeMetadata(bytes: Uint8Array, meta: PdfMetadata): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setKeywords(
    meta.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  );
  doc.setProducer('DocLab');
  return doc.save();
}
