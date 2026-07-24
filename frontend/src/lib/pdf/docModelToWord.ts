import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, ImageRun, WidthType, AlignmentType, LineRuleType, BorderStyle, type IParagraphOptions } from 'docx';
import { stripMarker } from './structure/assembleBlocks';
import { sanitizeXml } from './structure/sanitize';
import type { Block, DocModel, Line, ParaAttrs } from './structure/model';

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;

// Conversores numéricos defensivos (valores no finitos/negativos romperían docx).
const tw = (pt: number) => Math.max(0, Math.round((Number.isFinite(pt) ? pt : 0) * 20)); // pt → twips
const halfPt = (pt: number) => Math.min(400, Math.max(2, Math.round((Number.isFinite(pt) && pt > 0 ? pt : 12) * 2)));
const hexColor = (c?: string) => (c && /^#?[0-9a-fA-F]{6}$/.test(c.trim()) ? c.replace('#', '') : undefined);

function isPng(b: Uint8Array): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function runs(lines: Line[]): TextRun[] {
  return lines.map((l, i) => new TextRun({
    text: (i > 0 ? ' ' : '') + sanitizeXml(l.text),
    bold: l.bold,
    italics: l.italic,
    size: halfPt(l.fontSize),
    color: hexColor(l.color),
    font: l.fontFamily || undefined,
  }));
}

/** Traduce los atributos de maquetación del bloque a opciones de párrafo docx. */
function paraProps(a: ParaAttrs): IParagraphOptions {
  const line = a.lineSpacing ? Math.min(960, Math.max(240, Math.round(a.lineSpacing * 240))) : undefined;
  return {
    alignment: a.align && a.align !== 'left' ? ALIGN[a.align] : undefined,
    indent: (a.indentFirst || a.indentLeft)
      ? { firstLine: a.indentFirst ? tw(a.indentFirst) : undefined, left: a.indentLeft ? tw(a.indentLeft) : undefined }
      : undefined,
    spacing: (a.spaceBefore || a.spaceAfter || line)
      ? {
        before: a.spaceBefore ? tw(a.spaceBefore) : undefined,
        after: a.spaceAfter ? tw(a.spaceAfter) : undefined,
        line,
        lineRule: line ? LineRuleType.AUTO : undefined,
      }
      : undefined,
  };
}

const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: 'BBBBBB' };
const TABLE_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER, insideHorizontal: CELL_BORDER, insideVertical: CELL_BORDER };

function blockToDocx(b: Block): (Paragraph | Table)[] {
  if (b.kind === 'heading') return [new Paragraph({ heading: HEADINGS[b.level - 1] ?? HeadingLevel.HEADING_3, children: runs(b.lines), ...paraProps(b) })];
  if (b.kind === 'paragraph') return [new Paragraph({ children: runs(b.lines), ...paraProps(b) })];
  if (b.kind === 'list') {
    return b.items.map((l) => (b.ordered
      ? new Paragraph({ children: [new TextRun({ text: sanitizeXml(l.text), size: halfPt(l.fontSize) })] })
      : new Paragraph({ text: sanitizeXml(stripMarker(l.text)), bullet: { level: 0 } })));
  }
  if (b.kind === 'table') {
    const rows = b.table.rows.map((r) => new TableRow({
      children: r.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun(sanitizeXml(c))] })] })),
    }));
    const columnWidths = b.table.colWidths?.map((w) => Math.max(1, tw(w)));
    const total = columnWidths?.reduce((s, w) => s + w, 0);
    const useDxa = total != null && total > 0 && total < 100000;
    // Todas las tablas detectadas llevan líneas finas para que se lean (una factura sin
    // bordes es ilegible). Los falsos positivos se evitan en la detección, no quitando bordes.
    return [new Table({ rows, borders: TABLE_BORDERS, ...(useDxa ? { columnWidths } : {}), width: useDxa ? { size: total!, type: WidthType.DXA } : { size: 100, type: WidthType.PERCENTAGE } })];
  }
  // image (solo si es un PNG válido)
  if (!isPng(b.image.bytes)) return [];
  const px = (pt: number) => Math.max(1, Math.min(2400, Math.round((Number.isFinite(pt) ? pt : 1) * 1.3333)));
  return [new Paragraph({
    alignment: b.align ? ALIGN[b.align] : undefined,
    spacing: b.spaceBefore ? { before: tw(b.spaceBefore) } : undefined,
    children: [new ImageRun({ type: 'png', data: b.image.bytes, transformation: { width: px(b.w), height: px(b.h) } })],
  })];
}

/**
 * DocModel → Word (.docx). Flujo CONTINUO (no fuerza un salto de página por cada página
 * del PDF, que producía páginas en blanco al refluir el texto). Encabezados/pies repetidos
 * van al Header/Footer de la sección. Defensivo: ningún valor no finito/negativo llega a docx.
 */
export async function docModelToWord(doc: DocModel): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  for (const page of doc.pages) {
    for (const b of page.blocks) children.push(...blockToDocx(b));
  }

  const first = doc.pages[0];
  const m = first?.margin;
  const out = new Document({
    sections: [{
      properties: first ? {
        page: {
          size: { width: tw(first.width), height: tw(first.height) },
          ...(m ? { margin: { top: tw(m.top), right: tw(m.right), bottom: tw(m.bottom), left: tw(m.left) } } : {}),
        },
      } : undefined,
      children: children.length ? children : [new Paragraph('')],
    }],
  });
  return Packer.toBlob(out);
}
