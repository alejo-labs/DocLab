import { PDFDocument, degrees, rgb } from 'pdf-lib';
import type { FontFamily } from './annotations';
import { anchorBottomLeft, parsePages, standardFont, type Position } from './layout';

export type WatermarkPages = 'all' | 'even' | 'odd' | 'range';

export interface WatermarkOptions {
  mode: 'text' | 'image';
  // texto
  text: string;
  color: string;
  fontSize: number;
  font: FontFamily;
  // imagen
  image: { bytes: Uint8Array; format: 'png' | 'jpg' } | null;
  imageWidth: number; // puntos
  // común
  opacity: number;
  rotation: number;
  tile: boolean;
  position: Position;
  pages: WatermarkPages;
  range: string;
}

function hexToRgb(hex: string) {
  const c = hex.replace('#', '');
  return rgb(parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255);
}

export async function addWatermark(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  if (opts.mode === 'text' && !opts.text.trim()) throw new Error('Escribe el texto de la marca de agua.');
  if (opts.mode === 'image' && !opts.image) throw new Error('Sube una imagen para la marca de agua.');

  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages();
  const color = hexToRgb(opts.color);
  const font = opts.mode === 'text' ? await doc.embedFont(standardFont(opts.font)) : null;
  const embedded = opts.image
    ? opts.image.format === 'png'
      ? await doc.embedPng(opts.image.bytes)
      : await doc.embedJpg(opts.image.bytes)
    : null;

  const rangeSet = opts.pages === 'range' ? parsePages(opts.range, pages.length) : null;
  const applies = (i: number) => {
    const human = i + 1;
    if (opts.pages === 'even') return human % 2 === 0;
    if (opts.pages === 'odd') return human % 2 === 1;
    if (opts.pages === 'range') return rangeSet!.has(human);
    return true;
  };

  const elemW = opts.mode === 'text' ? font!.widthOfTextAtSize(opts.text, opts.fontSize) : opts.imageWidth;
  const elemH = opts.mode === 'text' ? opts.fontSize : opts.imageWidth / ((embedded!.width || 1) / (embedded!.height || 1));

  pages.forEach((page, i) => {
    if (!applies(i)) return;
    const { width, height } = page.getSize();

    const drawAt = (x: number, y: number) => {
      if (opts.mode === 'text') {
        page.drawText(opts.text, { x, y, size: opts.fontSize, font: font!, color, opacity: opts.opacity, rotate: degrees(opts.rotation) });
      } else {
        page.drawImage(embedded!, { x, y, width: elemW, height: elemH, opacity: opts.opacity, rotate: degrees(opts.rotation) });
      }
    };

    if (opts.tile) {
      const stepX = elemW + 80;
      const stepY = elemH + 100;
      for (let y = 0; y < height + stepY; y += stepY) {
        for (let x = -elemW; x < width; x += stepX) drawAt(x, y);
      }
    } else {
      const { x, y } = anchorBottomLeft(opts.position, width, height, elemW, elemH, 24);
      drawAt(x, y);
    }
  });

  doc.setProducer('DocLab');
  return doc.save();
}
