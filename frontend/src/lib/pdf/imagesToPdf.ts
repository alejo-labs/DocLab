import { PDFDocument, degrees } from 'pdf-lib';
import { detectImageType } from '../files';

export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'portrait' | 'landscape' | 'auto';

export interface SourceImage {
  bytes: Uint8Array;
  rotation?: number; // 0/90/180/270
}

export interface ImagesToPdfOptions {
  pageSize: PageSize;
  orientation: Orientation;
  margin: number; // puntos
}

const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Rota (dx,dy) por `deg` grados en sistema PDF (y arriba). */
function rot(dx: number, dy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: dx * Math.cos(r) - dy * Math.sin(r), y: dx * Math.sin(r) + dy * Math.cos(r) };
}

/**
 * Crea un PDF a partir de imágenes JPG/PNG con tamaño de página, orientación,
 * márgenes y rotación por imagen.
 */
export async function imagesToPdf(images: SourceImage[], opts: ImagesToPdfOptions): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('Añade al menos una imagen.');
  const doc = await PDFDocument.create();

  for (const image of images) {
    const type = detectImageType(image.bytes);
    if (!type) throw new Error('Solo se admiten imágenes JPG o PNG.');
    const embedded = type === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);

    const rotation = ((image.rotation ?? 0) % 360 + 360) % 360;
    const swapped = rotation === 90 || rotation === 270;
    // Dimensiones efectivas de la imagen tras rotar.
    const imgW = swapped ? embedded.height : embedded.width;
    const imgH = swapped ? embedded.width : embedded.height;

    // Tamaño de página.
    let pageW: number;
    let pageH: number;
    if (opts.pageSize === 'fit') {
      pageW = imgW + opts.margin * 2;
      pageH = imgH + opts.margin * 2;
    } else {
      const [w, h] = SIZES[opts.pageSize];
      const landscape = opts.orientation === 'landscape' || (opts.orientation === 'auto' && imgW > imgH);
      pageW = landscape ? h : w;
      pageH = landscape ? w : h;
    }
    const page = doc.addPage([pageW, pageH]);

    // Escala manteniendo proporción dentro del área útil (con márgenes).
    const maxW = pageW - opts.margin * 2;
    const maxH = pageH - opts.margin * 2;
    const scale = Math.min(maxW / imgW, maxH / imgH, opts.pageSize === 'fit' ? 1 : Infinity);
    const drawW = imgW * scale; // caja efectiva (ya rotada)
    const drawH = imgH * scale;
    const boxX = (pageW - drawW) / 2;
    const boxY = (pageH - drawH) / 2;

    if (rotation === 0) {
      page.drawImage(embedded, { x: boxX, y: boxY, width: drawW, height: drawH });
    } else {
      // Dibuja con el ancho/alto SIN rotar y rota alrededor del centro de la caja.
      const realW = embedded.width * scale;
      const realH = embedded.height * scale;
      const cx = boxX + drawW / 2;
      const cy = boxY + drawH / 2;
      const r = rot(-realW / 2, -realH / 2, rotation);
      page.drawImage(embedded, { x: cx + r.x, y: cy + r.y, width: realW, height: realH, rotate: degrees(rotation) });
    }
  }

  doc.setProducer('DocLab');
  return doc.save();
}
