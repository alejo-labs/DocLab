import { PDFDocument, rgb } from 'pdf-lib';
import type { FontFamily } from './annotations';
import { anchorBottomLeft, standardFont, type Position } from './layout';

export interface PageNumberOptions {
  position: Position;
  template: string; // usa {n}, {total}, {N} (con ceros)
  startAt: number;
  fontSize: number;
  color: string;
  font: FontFamily;
  margin: number;
  /** Páginas (1-based) que NO reciben número. */
  skip: number[];
  /** Si true, las páginas omitidas igualmente avanzan el contador. */
  countSkipped: boolean;
}

function hexToRgb(hex: string) {
  const c = hex.replace('#', '');
  return rgb(parseInt(c.slice(0, 2), 16) / 255, parseInt(c.slice(2, 4), 16) / 255, parseInt(c.slice(4, 6), 16) / 255);
}

export function formatNumber(template: string, n: number, total: number): string {
  return template
    .replace(/\{total\}/g, String(total))
    .replace(/\{N\}/g, String(n).padStart(3, '0'))
    .replace(/\{n\}/g, String(n));
}

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(standardFont(opts.font));
  const color = hexToRgb(opts.color);
  const pages = doc.getPages();
  const total = pages.length;
  const skip = new Set(opts.skip);

  let counter = opts.startAt;
  pages.forEach((page, i) => {
    const human = i + 1;
    if (skip.has(human)) {
      if (opts.countSkipped) counter += 1;
      return;
    }
    const text = formatNumber(opts.template, counter, total);
    const textWidth = font.widthOfTextAtSize(text, opts.fontSize);
    const { width, height } = page.getSize();
    const { x, y } = anchorBottomLeft(opts.position, width, height, textWidth, opts.fontSize, opts.margin);
    page.drawText(text, { x, y, size: opts.fontSize, font, color });
    counter += 1;
  });

  doc.setProducer('DocLab');
  return doc.save();
}
