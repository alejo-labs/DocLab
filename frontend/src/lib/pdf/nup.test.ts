import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { nUpPdf } from './nup';

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont('Helvetica');
  for (let i = 0; i < pages; i += 1) {
    const p = doc.addPage([300, 400]);
    p.drawText(`Página ${i + 1}`, { x: 20, y: 200, size: 20, font }); // asegura /Contents
  }
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe('nUpPdf', () => {
  it('2 por hoja: 4 páginas → 2 hojas', async () => {
    const out = await nUpPdf(await makePdf(4), { perSheet: 2 });
    expect(await countPages(out)).toBe(2);
  });
  it('4 por hoja: 5 páginas → 2 hojas', async () => {
    const out = await nUpPdf(await makePdf(5), { perSheet: 4 });
    expect(await countPages(out)).toBe(2);
  });
  it('9 por hoja: 9 páginas → 1 hoja', async () => {
    const out = await nUpPdf(await makePdf(9), { perSheet: 9 });
    expect(await countPages(out)).toBe(1);
  });
});
