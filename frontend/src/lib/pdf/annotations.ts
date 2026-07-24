import { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, type PDFFont, type PDFPage } from 'pdf-lib';

export type FontFamily = 'helvetica' | 'times' | 'courier';
export type TextAlign = 'left' | 'center' | 'right';
export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow';

const FONT_VARIANTS: Record<
  FontFamily,
  { label: string; css: string; n: StandardFonts; b: StandardFonts; i: StandardFonts; bi: StandardFonts }
> = {
  helvetica: { label: 'Sans', css: 'Helvetica, Arial, sans-serif', n: StandardFonts.Helvetica, b: StandardFonts.HelveticaBold, i: StandardFonts.HelveticaOblique, bi: StandardFonts.HelveticaBoldOblique },
  times: { label: 'Serif', css: '"Times New Roman", Times, serif', n: StandardFonts.TimesRoman, b: StandardFonts.TimesRomanBold, i: StandardFonts.TimesRomanItalic, bi: StandardFonts.TimesRomanBoldItalic },
  courier: { label: 'Mono', css: '"Courier New", Courier, monospace', n: StandardFonts.Courier, b: StandardFonts.CourierBold, i: StandardFonts.CourierOblique, bi: StandardFonts.CourierBoldOblique },
};

export const FONTS: Record<FontFamily, { label: string; css: string }> = {
  helvetica: { label: 'Sans', css: FONT_VARIANTS.helvetica.css },
  times: { label: 'Serif', css: FONT_VARIANTS.times.css },
  courier: { label: 'Mono', css: FONT_VARIANTS.courier.css },
};

function standardFor(family: FontFamily, bold: boolean, italic: boolean): StandardFonts {
  const v = FONT_VARIANTS[family];
  if (bold && italic) return v.bi;
  if (bold) return v.b;
  if (italic) return v.i;
  return v.n;
}

export interface Point {
  x: number;
  y: number;
}

interface BaseAnnotation {
  id: string;
  page: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  lineHeight: number;
  opacity: number;
  rotation: number; // grados, sentido horario en pantalla
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: Uint8Array;
  format: 'png' | 'jpg';
  opacity: number;
  rotation: number;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: 'draw';
  color: string;
  width: number;
  points: Point[];
  opacity: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape';
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  opacity: number;
  rotation: number;
}

export type Annotation = TextAnnotation | ImageAnnotation | DrawAnnotation | HighlightAnnotation | ShapeAnnotation;

function hexToRgb(hex: string) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return rgb(Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b);
}

/** Rota (dx,dy) por `deg` grados en sistema PDF (y hacia arriba). */
function rotXY(dx: number, dy: number, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * Ancla (esquina inferior-izquierda) para que pdf-lib dibuje una caja rotada
 * alrededor de SU CENTRO. `screenDeg` es horario en pantalla → pdf usa -screenDeg.
 */
function centerAnchor(x: number, y: number, w: number, h: number, H: number, screenDeg: number) {
  const cx = x + w / 2;
  const cy = H - (y + h / 2);
  const pdfDeg = -screenDeg;
  const r = rotXY(-w / 2, -h / 2, pdfDeg);
  return { x: cx + r.x, y: cy + r.y, pdfDeg };
}

/**
 * Aplica las anotaciones sobre el PDF. El orden del array es el z-order (los
 * últimos encima). Todo en memoria del navegador.
 */
export async function applyAnnotations(pdfBytes: Uint8Array, annotations: Annotation[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  const fontCache = new Map<StandardFonts, PDFFont>();
  const getFont = async (std: StandardFonts): Promise<PDFFont> => {
    let f = fontCache.get(std);
    if (!f) {
      f = await doc.embedFont(std);
      fontCache.set(std, f);
    }
    return f;
  };

  for (const ann of annotations) {
    const page = pages[ann.page];
    if (!page) continue;
    const H = page.getHeight();

    if (ann.type === 'text') {
      await drawText(page, ann, H, getFont);
    } else if (ann.type === 'highlight') {
      page.drawRectangle({ x: ann.x, y: H - ann.y - ann.height, width: ann.width, height: ann.height, color: hexToRgb(ann.color), opacity: ann.opacity });
    } else if (ann.type === 'draw') {
      for (let i = 1; i < ann.points.length; i += 1) {
        const a = ann.points[i - 1]!;
        const b = ann.points[i]!;
        page.drawLine({ start: { x: a.x, y: H - a.y }, end: { x: b.x, y: H - b.y }, thickness: ann.width, color: hexToRgb(ann.color), opacity: ann.opacity, lineCap: LineCapStyle.Round });
      }
    } else if (ann.type === 'image') {
      const embedded = ann.format === 'png' ? await doc.embedPng(ann.bytes) : await doc.embedJpg(ann.bytes);
      const a = centerAnchor(ann.x, ann.y, ann.width, ann.height, H, ann.rotation);
      page.drawImage(embedded, { x: a.x, y: a.y, width: ann.width, height: ann.height, opacity: ann.opacity, rotate: degrees(a.pdfDeg) });
    } else {
      drawShape(page, ann, H);
    }
  }

  doc.setProducer('DocLab');
  return doc.save();
}

async function drawText(page: PDFPage, ann: TextAnnotation, H: number, getFont: (s: StandardFonts) => Promise<PDFFont>) {
  const font = await getFont(standardFor(ann.font ?? 'helvetica', ann.bold, ann.italic));
  const lines = ann.text.split('\n');
  const lineH = ann.size * (ann.lineHeight || 1.2);
  const widths = lines.map((l) => font.widthOfTextAtSize(l, ann.size));
  const boxW = Math.max(1, ...widths);
  const boxH = lines.length * lineH;
  const cx = ann.x + boxW / 2;
  const cy = H - (ann.y + boxH / 2);
  const pdfDeg = -ann.rotation;
  const color = hexToRgb(ann.color);

  lines.forEach((line, i) => {
    const alignX = ann.align === 'center' ? (boxW - widths[i]!) / 2 : ann.align === 'right' ? boxW - widths[i]! : 0;
    // posición del inicio de la línea relativa al centro de la caja (coords PDF)
    const relX = alignX - boxW / 2;
    const relY = boxH / 2 - (ann.size + i * lineH);
    const r = rotXY(relX, relY, pdfDeg);
    const px = cx + r.x;
    const py = cy + r.y;
    page.drawText(line, { x: px, y: py, size: ann.size, font, color, opacity: ann.opacity, rotate: degrees(pdfDeg) });
    if (ann.underline && line.length > 0) {
      const u = rotXY(widths[i]!, 0, pdfDeg);
      const off = rotXY(0, -ann.size * 0.12, pdfDeg);
      page.drawLine({ start: { x: px + off.x, y: py + off.y }, end: { x: px + off.x + u.x, y: py + off.y + u.y }, thickness: Math.max(0.5, ann.size * 0.06), color, opacity: ann.opacity });
    }
  });
}

function drawShape(page: PDFPage, s: ShapeAnnotation, H: number): void {
  const stroke = hexToRgb(s.strokeColor);
  const fill = s.fillColor ? hexToRgb(s.fillColor) : undefined;
  const w = Math.abs(s.width);
  const h = Math.abs(s.height);
  const x = Math.min(s.x, s.x + s.width);
  const y = Math.min(s.y, s.y + s.height);

  if (s.kind === 'rect') {
    const a = centerAnchor(x, y, w, h, H, s.rotation);
    page.drawRectangle({ x: a.x, y: a.y, width: w, height: h, borderColor: stroke, borderWidth: s.strokeWidth, color: fill, opacity: fill ? s.opacity : undefined, borderOpacity: s.opacity, rotate: degrees(a.pdfDeg) });
  } else if (s.kind === 'ellipse') {
    page.drawEllipse({ x: x + w / 2, y: H - (y + h / 2), xScale: w / 2, yScale: h / 2, rotate: degrees(-s.rotation), borderColor: stroke, borderWidth: s.strokeWidth, color: fill, opacity: fill ? s.opacity : undefined, borderOpacity: s.opacity });
  } else {
    const start = { x: s.x, y: H - s.y };
    const end = { x: s.x + s.width, y: H - (s.y + s.height) };
    page.drawLine({ start, end, thickness: s.strokeWidth, color: stroke, opacity: s.opacity, lineCap: LineCapStyle.Round });
    if (s.kind === 'arrow') {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const head = Math.max(8, s.strokeWidth * 3);
      const wing = Math.PI / 7;
      for (const sign of [1, -1]) {
        const a = angle + Math.PI - sign * wing;
        page.drawLine({ start: end, end: { x: end.x + head * Math.cos(a), y: end.y + head * Math.sin(a) }, thickness: s.strokeWidth, color: stroke, opacity: s.opacity, lineCap: LineCapStyle.Round });
      }
    }
  }
}
