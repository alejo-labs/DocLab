import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { unzipSync, strFromU8 } from 'fflate';
import { parseStyles, parseSharedStrings, parseSheet, parseWorkbook, type XlsxStyles, type XlsxSheet, type XlsxCell } from './xlsxModel';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 36;
const PAD = 2;

/** Ancho de columna Excel (en "caracteres") → puntos PDF (MDW≈7px, 96→72dpi). */
const charsToPt = (chars: number) => (chars * 7 + 5) * 0.75;

/** Grosor de línea por estilo de borde OOXML. */
function borderThickness(style: string): number {
  switch (style) {
    case 'hair': return 0.25;
    case 'thin': return 0.5;
    case 'dotted': case 'dashed': return 0.5;
    case 'medium': case 'mediumDashed': return 1.25;
    case 'thick': return 2;
    case 'double': return 1;
    default: return 0.5;
  }
}

function hexRgb(hex?: string): RGB | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return undefined;
  const int = parseInt(m[1]!, 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

// Excel: serial de fecha (día 1 = 1900-01-01, con el bug del año bisiesto 1900).
function serialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}
const pad2 = (n: number) => String(n).padStart(2, '0');

const DATE_FMT_IDS = new Set([14, 15, 16, 17, 22]);
const TIME_FMT_IDS = new Set([18, 19, 20, 21, 45, 46, 47]);

/** Formatea el valor de una celda según su tipo y numFmt (subconjunto habitual). */
function formatValue(cell: XlsxCell, styles: XlsxStyles, shared: string[]): string {
  const { type, raw } = cell;
  if (raw === '' && type !== 'n') return '';
  if (type === 's') { const i = parseInt(raw, 10); return Number.isFinite(i) ? (shared[i] ?? '') : ''; }
  if (type === 'inlineStr' || type === 'str') return raw;
  if (type === 'b') return raw === '1' ? 'VERDADERO' : 'FALSO';
  if (type === 'e') return raw;
  // numérico
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const xf = styles.cellXfs[cell.styleId];
  const id = xf?.numFmtId ?? 0;
  const code = styles.numFmts[id] ?? '';
  const looksDate = DATE_FMT_IDS.has(id) || (/[dy]/.test(code) && /m/i.test(code) && !code.includes('%'));
  const looksTime = TIME_FMT_IDS.has(id) || (/h/i.test(code) && !looksDate);
  if (looksDate) {
    const d = serialToDate(n);
    return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }
  if (looksTime) {
    const secs = Math.round((n - Math.floor(n)) * 86400);
    return `${pad2(Math.floor(secs / 3600))}:${pad2(Math.floor((secs % 3600) / 60))}`;
  }
  if (id === 9 || id === 10 || code.includes('%')) {
    const dec = id === 10 || /\.0/.test(code) ? 2 : 0;
    return `${(n * 100).toFixed(dec)}%`;
  }
  // General / numérico: hasta 10 dígitos significativos, sin ceros de cola.
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(10)));
}

interface Fonts { reg: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont }
function pickFont(f: Fonts, bold: boolean, italic: boolean): PDFFont {
  if (bold && italic) return f.boldItalic;
  if (bold) return f.bold;
  if (italic) return f.italic;
  return f.reg;
}

/**
 * Excel (.xlsx) → PDF on-device, preservando estilos: bordes (grosor por estilo),
 * rellenos de celda, fuentes en negrita/cursiva, color, alineación y combinaciones.
 * Parseo OOXML con parser propio + fflate; render con pdf-lib. Nada sale del dispositivo.
 */
export async function xlsxToPdf(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const files = unzipSync(bytes);
  const read = (path: string): string | undefined => (files[path] ? strFromU8(files[path]!) : undefined);

  const styles = read('xl/styles.xml') ? parseStyles(read('xl/styles.xml')!) : { fonts: [], fills: [], borders: [], cellXfs: [], numFmts: {} };
  const shared = read('xl/sharedStrings.xml') ? parseSharedStrings(read('xl/sharedStrings.xml')!) : [];
  const wbXml = read('xl/workbook.xml');
  const relsXml = read('xl/_rels/workbook.xml.rels');
  let sheetRefs = wbXml && relsXml ? parseWorkbook(wbXml, relsXml) : [];
  // Fallback: si no se pudo mapear, toma las hojas por orden de archivo.
  if (sheetRefs.length === 0) {
    sheetRefs = Object.keys(files)
      .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
      .sort()
      .map((p, i) => ({ name: `Hoja ${i + 1}`, path: p }));
  }

  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  const usableW = A4.w - MARGIN * 2;
  const usableBottom = A4.h - MARGIN;

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let cursorY = MARGIN; // top-down

  const total = sheetRefs.length || 1;
  sheetRefs.forEach((ref, si) => {
    const xml = read(ref.path);
    if (si > 0) { page = pdf.addPage([A4.w, A4.h]); cursorY = MARGIN; }
    // Título de la hoja.
    page.drawText(ref.name, { x: MARGIN, y: A4.h - MARGIN - 11, size: 11, font: fonts.bold, color: rgb(0.1, 0.1, 0.12) });
    cursorY = MARGIN + 20;
    if (!xml) { onProgress?.(si + 1, total); return; }
    const sheet = parseSheet(xml);
    renderSheet(pdf, () => page, (p) => { page = p; }, () => cursorY, (y) => { cursorY = y; }, sheet, styles, shared, fonts, usableW, usableBottom);
    onProgress?.(si + 1, total);
  });

  return pdf.save();
}

function renderSheet(
  pdf: PDFDocument,
  getPage: () => PDFPage,
  setPage: (p: PDFPage) => void,
  getY: () => number,
  setY: (y: number) => void,
  sheet: XlsxSheet,
  styles: XlsxStyles,
  shared: string[],
  fonts: Fonts,
  usableW: number,
  usableBottom: number,
): void {
  if (sheet.maxCol === 0 || sheet.maxRow === 0) {
    getPage().drawText('(hoja vacía)', { x: MARGIN, y: A4.h - getY() - 10, size: 9, font: fonts.italic, color: rgb(0.5, 0.5, 0.5) });
    return;
  }

  // Anchos de columna (chars → pt) y escala para caber a lo ancho.
  const colChars: number[] = Array.from({ length: sheet.maxCol + 1 }, () => 8.43);
  for (const c of sheet.cols) for (let k = c.min; k <= Math.min(c.max, sheet.maxCol); k += 1) colChars[k] = c.width;
  let totalW = 0;
  for (let c = 1; c <= sheet.maxCol; c += 1) totalW += charsToPt(colChars[c]!);
  const scale = totalW > usableW ? usableW / totalW : 1;

  const colW: number[] = Array.from({ length: sheet.maxCol + 2 }, () => 0);
  for (let c = 1; c <= sheet.maxCol; c += 1) colW[c] = charsToPt(colChars[c]!) * scale;
  const colX: number[] = Array.from({ length: sheet.maxCol + 2 }, () => MARGIN);
  for (let c = 2; c <= sheet.maxCol; c += 1) colX[c] = colX[c - 1]! + colW[c - 1]!;

  const rowH: number[] = Array.from({ length: sheet.maxRow + 1 }, () => 15 * scale);
  for (let r = 1; r <= sheet.maxRow; r += 1) rowH[r] = (sheet.rowHeights[r] ?? 15) * scale;

  // Combinaciones: anclas + celdas cubiertas.
  const anchor = new Map<string, { c2: number; r2: number }>();
  const covered = new Set<string>();
  for (const m of sheet.merges) {
    anchor.set(`${m.r1}:${m.c1}`, { c2: m.c2, r2: m.r2 });
    for (let r = m.r1; r <= m.r2; r += 1) for (let c = m.c1; c <= m.c2; c += 1) if (!(r === m.r1 && c === m.c1)) covered.add(`${r}:${c}`);
  }

  // Celdas por fila.
  const byRow = new Map<number, XlsxCell[]>();
  for (const cell of sheet.cells) { const list = byRow.get(cell.row) ?? []; list.push(cell); byRow.set(cell.row, list); }

  for (let r = 1; r <= sheet.maxRow; r += 1) {
    const h = rowH[r]!;
    if (getY() + h > usableBottom) { const p = pdf.addPage([A4.w, A4.h]); setPage(p); setY(MARGIN); }
    const top = getY();
    for (const cell of byRow.get(r) ?? []) {
      const key = `${cell.row}:${cell.col}`;
      if (covered.has(key)) continue;
      const span = anchor.get(key);
      let cw = colW[cell.col] ?? 0;
      let ch = h;
      if (span) {
        cw = 0; for (let c = cell.col; c <= span.c2; c += 1) cw += colW[c] ?? 0;
        ch = 0; for (let rr = cell.row; rr <= span.r2; rr += 1) ch += rowH[rr] ?? 0;
      }
      drawCell(getPage(), cell, colX[cell.col]!, top, cw, ch, styles, shared, fonts, scale);
    }
    setY(getY() + h);
  }
}

function drawCell(
  page: PDFPage, cell: XlsxCell, x: number, top: number, w: number, h: number,
  styles: XlsxStyles, shared: string[], fonts: Fonts, scale: number,
): void {
  const xf = styles.cellXfs[cell.styleId];
  const pageH = page.getHeight();
  const yBottom = pageH - (top + h);

  // Relleno.
  const fillHex = xf ? styles.fills[xf.fillId] : undefined;
  const fill = hexRgb(fillHex);
  if (fill) page.drawRectangle({ x, y: yBottom, width: w, height: h, color: fill });

  // Texto.
  const text = formatValue(cell, styles, shared);
  if (text) {
    const font = styles.fonts[xf?.fontId ?? 0];
    const pdfFont = pickFont(fonts, font?.bold ?? false, font?.italic ?? false);
    let fs = Math.max(4, Math.min((font?.size ?? 11) * scale, h - PAD));
    const color = hexRgb(font?.color) ?? rgb(0, 0, 0);
    let str = text;
    const avail = w - PAD * 2;
    while (str.length > 1 && pdfFont.widthOfTextAtSize(str, fs) > avail) str = str.slice(0, -1);
    const tw = pdfFont.widthOfTextAtSize(str, fs);
    const align = xf?.hAlign && xf.hAlign !== 'general' ? xf.hAlign : (cell.type === 'n' ? 'right' : cell.type === 'b' ? 'center' : 'left');
    let tx = x + PAD;
    if (align === 'right') tx = x + w - PAD - tw;
    else if (align === 'center' || align === 'centerContinuous') tx = x + (w - tw) / 2;
    const ty = pageH - (top + h / 2) - fs * 0.35;
    page.drawText(str, { x: Math.max(x + PAD, tx), y: ty, size: fs, font: pdfFont, color });
  }

  // Bordes (encima).
  const b = xf ? styles.borders[xf.borderId] : undefined;
  if (b) {
    const yTop = pageH - top;
    const draw = (x1: number, y1: number, x2: number, y2: number, side?: { style: string; color?: string }) => {
      if (!side) return;
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: borderThickness(side.style) * scale, color: hexRgb(side.color) ?? rgb(0.55, 0.55, 0.55) });
    };
    draw(x, yTop, x + w, yTop, b.top);
    draw(x, yBottom, x + w, yBottom, b.bottom);
    draw(x, yTop, x, yBottom, b.left);
    draw(x + w, yTop, x + w, yBottom, b.right);
  }
}
