import type { PDFPageProxy } from 'pdfjs-dist';
import type { Span } from './model';

interface FontInfo { family: string; bold: boolean; italic: boolean }

const FONT_MAP: Record<string, string> = {
  arial: 'Arial', arialmt: 'Arial', helvetica: 'Helvetica', helveticaneue: 'Helvetica',
  times: 'Times New Roman', timesnewroman: 'Times New Roman', timesnewromanpsmt: 'Times New Roman',
  courier: 'Courier New', couriernew: 'Courier New', calibri: 'Calibri', cambria: 'Cambria',
  georgia: 'Georgia', verdana: 'Verdana', tahoma: 'Tahoma', garamond: 'Garamond', roboto: 'Roboto',
};

/** Normaliza un nombre PostScript a una familia limpia que Word/PowerPoint reconozca. */
function cleanFontFamily(raw: string): string {
  const base = raw.replace(/^[A-Z]{6}\+/, '').split(',')[0]!.trim();
  const keyRaw = base.toLowerCase().replace(/[\s-]/g, '');
  if (FONT_MAP[keyRaw]) return FONT_MAP[keyRaw];
  const keyNoStyle = keyRaw.replace(/(bolditalic|bold|italic|oblique|regular|light|medium|semibold|black|heavy|condensed|roman|thin|psmt|mt|ps)/g, '');
  if (FONT_MAP[keyNoStyle]) return FONT_MAP[keyNoStyle];
  const n = base.replace(/[-_ ]?(BoldItalic|Bold|Italic|Oblique|Regular|Light|Medium|SemiBold|Black|Heavy|Condensed|Roman|Thin|MT|PS|PSMT)/gi, '').replace(/[-_\s]+$/g, '').trim();
  return n || 'Calibri';
}

/** Resuelve negrita/cursiva/familia de una fuente pdf.js (con caché por página). */
function resolveFont(page: PDFPageProxy, fontName: string, cache: Map<string, FontInfo>): FontInfo {
  const hit = cache.get(fontName);
  if (hit) return hit;
  let info: FontInfo = { family: 'Calibri', bold: false, italic: false };
  try {
    // pdf.js guarda el objeto de fuente resuelto en commonObjs tras getTextContent.
    const objs = (page as unknown as { commonObjs: { has(id: string): boolean; get(id: string): unknown } }).commonObjs;
    if (objs?.has(fontName)) {
      const f = objs.get(fontName) as { name?: string; bold?: boolean; italic?: boolean; black?: boolean } | undefined;
      const name = f?.name ?? '';
      const bold = f?.bold === true || f?.black === true || /bold|black|heavy|semibold|w[6-9]00/i.test(name);
      const italic = f?.italic === true || /italic|oblique/i.test(name);
      info = { family: cleanFontFamily(name), bold, italic };
    }
  } catch {
    /* fuente no resuelta: heurística neutra */
  }
  cache.set(fontName, info);
  return info;
}

/**
 * Extrae los spans de texto de una página (con estilo), en coords top-left (y hacia abajo).
 * Usa pdf.js getTextContent; requiere navegador (worker pdf.js).
 */
export async function pageSpans(page: PDFPageProxy, pageHeight: number): Promise<Span[]> {
  const content = await page.getTextContent();
  const fontCache = new Map<string, FontInfo>();
  const spans: Span[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const it = item as { str: string; width: number; height: number; transform: number[]; fontName: string };
    if (!it.str) continue;
    const tr = it.transform;
    const fontSize = Math.hypot(tr[2] ?? 0, tr[3] ?? 0) || it.height || 12;
    const xUser = tr[4] ?? 0;
    const yBaseline = tr[5] ?? 0;
    const font = resolveFont(page, it.fontName, fontCache);
    spans.push({
      text: it.str,
      x: xUser,
      y: pageHeight - yBaseline - fontSize, // baseline (bottom-left) → top de la caja (top-left)
      w: it.width || it.str.length * fontSize * 0.5,
      h: fontSize,
      fontSize,
      bold: font.bold,
      italic: font.italic,
      fontFamily: font.family,
    });
  }
  return spans;
}
