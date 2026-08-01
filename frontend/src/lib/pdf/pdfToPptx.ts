import pptxgen from 'pptxgenjs';
import { extractStructure, type PageRange } from './structure/extractStructure';
import { stripMarker } from './structure/assembleBlocks';
import { sanitizeXml } from './structure/sanitize';
import type { Block } from './structure/model';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function isPng(b: Uint8Array): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

/**
 * PDF → PowerPoint (.pptx) on-device, con TEXTO EDITABLE por bloque (no la página como
 * imagen). Usa el análisis de layout para colocar cada bloque/tabla/imagen en su sitio.
 */
export async function pdfToPptx(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
  range?: PageRange,
): Promise<Blob> {
  const doc = await extractStructure(bytes, onProgress, range);
  const pptx = new pptxgen();
  const first = doc.pages[0];
  const W = (first?.width ?? 612) / 72;
  const H = (first?.height ?? 792) / 72;
  pptx.defineLayout({ name: 'DOCLAB_PAGE', width: W, height: H });
  pptx.layout = 'DOCLAB_PAGE';
  const inch = (pt: number) => pt / 72;

  for (const page of doc.pages) {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    const sw = page.width / 72;
    const sh = page.height / 72;
    for (const b of page.blocks) {
      const x = Math.max(0, Math.min(inch(b.x), sw - 0.2));
      const y = Math.max(0, Math.min(inch(b.y), sh - 0.2));
      const w = Math.max(0.3, Math.min(inch(b.w), sw - x));
      const h = Math.max(0.2, Math.min(inch(b.h), sh - y));
      if (b.kind === 'image') {
        if (isPng(b.image.bytes)) slide.addImage({ data: `data:image/png;base64,${bytesToBase64(b.image.bytes)}`, x, y, w, h });
      } else if (b.kind === 'table') {
        const rows = b.table.rows.map((r) => r.map((c) => ({ text: sanitizeXml(c) })));
        slide.addTable(rows, { x, y, w, h, fontSize: 10, border: { type: 'solid', pt: 0.5, color: 'BBBBBB' }, valign: 'top' });
      } else {
        const text = sanitizeXml(blockText(b));
        if (!text) continue;
        const fontSize = blockFont(b);
        const align = (b.kind === 'paragraph' || b.kind === 'heading' || b.kind === 'list') && b.align ? b.align : 'left';
        const ls = (b.kind === 'paragraph' || b.kind === 'heading') && b.lineSpacing ? b.lineSpacing : undefined;
        const first = b.kind === 'list' ? b.items[0] : b.lines[0];
        const color = first?.color ? first.color.replace('#', '') : undefined;
        const fontFace = first?.fontFamily || undefined;
        slide.addText(text, { x, y, w, h: Math.max(h, inch(fontSize * 1.4)), fontSize, bold: blockBold(b), valign: 'top', align, ...(ls ? { lineSpacingMultiple: ls } : {}), ...(color ? { color } : {}), ...(fontFace ? { fontFace } : {}), autoFit: true });
      }
    }
    onProgress?.(doc.pages.indexOf(page) + 1, doc.pages.length);
  }

  return pptx.write({ outputType: 'blob' }) as Promise<Blob>;
}

function blockText(b: Block): string {
  if (b.kind === 'heading') return b.lines.map((l) => l.text).join(' ');
  if (b.kind === 'paragraph') return b.lines.map((l) => l.text).join(' ');
  if (b.kind === 'list') return b.items.map((l) => `• ${stripMarker(l.text)}`).join('\n');
  return '';
}
function blockFont(b: Block): number {
  if (b.kind === 'heading') return Math.round((b.lines[0]?.fontSize ?? 18));
  if (b.kind === 'paragraph') return Math.round((b.lines[0]?.fontSize ?? 12));
  if (b.kind === 'list') return Math.round((b.items[0]?.fontSize ?? 12));
  return 12;
}
function blockBold(b: Block): boolean {
  if (b.kind === 'heading') return true;
  if (b.kind === 'paragraph') return b.lines.every((l) => l.bold);
  return false;
}
