import { parseXml, child, kids, attr, type XmlNode } from './xml';

/** Modelo de estilos resuelto desde `xl/styles.xml`. */
export interface XlsxFont { size: number; bold: boolean; italic: boolean; color?: string; name?: string }
export interface XlsxBorderSide { style: string; color?: string }
export interface XlsxBorders { left?: XlsxBorderSide; right?: XlsxBorderSide; top?: XlsxBorderSide; bottom?: XlsxBorderSide }
export interface XlsxXf {
  fontId: number; fillId: number; borderId: number; numFmtId: number;
  applyFont: boolean; applyFill: boolean; applyBorder: boolean;
  hAlign?: string; vAlign?: string; wrap: boolean;
}
export interface XlsxStyles { fonts: XlsxFont[]; fills: (string | undefined)[]; borders: XlsxBorders[]; cellXfs: XlsxXf[]; numFmts: Record<number, string> }

const num = (v: string | undefined, d = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const isTrue = (v: string | undefined): boolean => v === '1' || v === 'true' || v === 'on';
/** Un elemento booleano OOXML (`<b/>`, `<b val="0"/>`): presente = true salvo val falso. */
const boolElem = (node: XmlNode | undefined): boolean => !!node && attr(node, 'val') !== '0' && attr(node, 'val') !== 'false';

/** Color de un `<color rgb="FFRRGGBB"/>` (ARGB u RGB). Theme/indexed → indefinido (v1). */
export function colorOf(node?: XmlNode): string | undefined {
  if (!node) return undefined;
  const rgb = attr(node, 'rgb');
  if (rgb && /^[0-9a-fA-F]{8}$/.test(rgb)) return `#${rgb.slice(2).toUpperCase()}`;
  if (rgb && /^[0-9a-fA-F]{6}$/.test(rgb)) return `#${rgb.toUpperCase()}`;
  return undefined;
}

function parseSide(node?: XmlNode): XlsxBorderSide | undefined {
  if (!node) return undefined;
  const style = attr(node, 'style');
  if (!style || style === 'none') return undefined;
  return { style, color: colorOf(child(node, 'color')) };
}

/** Parsea `xl/styles.xml` → tablas de fuentes/rellenos/bordes/xf/numFmts. */
export function parseStyles(xml: string): XlsxStyles {
  const root = parseXml(xml);
  const fonts: XlsxFont[] = kids(child(root, 'fonts') ?? root, 'font').map((f) => ({
    size: num(attr(child(f, 'sz'), 'val'), 11),
    bold: boolElem(child(f, 'b')),
    italic: boolElem(child(f, 'i')),
    color: colorOf(child(f, 'color')),
    name: attr(child(f, 'name'), 'val'),
  }));
  const fills: (string | undefined)[] = kids(child(root, 'fills') ?? root, 'fill').map((fill) => {
    const pf = child(fill, 'patternFill');
    const pt = pf ? attr(pf, 'patternType') : undefined;
    if (!pf || !pt || pt === 'none' || pt === 'gray125') return undefined;
    return colorOf(child(pf, 'fgColor'));
  });
  const borders: XlsxBorders[] = kids(child(root, 'borders') ?? root, 'border').map((b) => ({
    left: parseSide(child(b, 'left')),
    right: parseSide(child(b, 'right')),
    top: parseSide(child(b, 'top')),
    bottom: parseSide(child(b, 'bottom')),
  }));
  const cellXfsParent = child(root, 'cellXfs');
  const cellXfs: XlsxXf[] = kids(cellXfsParent ?? root, 'xf').map((xf) => {
    const al = child(xf, 'alignment');
    return {
      fontId: num(attr(xf, 'fontId')),
      fillId: num(attr(xf, 'fillId')),
      borderId: num(attr(xf, 'borderId')),
      numFmtId: num(attr(xf, 'numFmtId')),
      applyFont: isTrue(attr(xf, 'applyFont')),
      applyFill: isTrue(attr(xf, 'applyFill')),
      applyBorder: isTrue(attr(xf, 'applyBorder')),
      hAlign: al ? attr(al, 'horizontal') : undefined,
      vAlign: al ? attr(al, 'vertical') : undefined,
      wrap: al ? isTrue(attr(al, 'wrapText')) : false,
    };
  });
  const numFmts: Record<number, string> = {};
  for (const nf of kids(child(root, 'numFmts') ?? root, 'numFmt')) {
    const id = num(attr(nf, 'numFmtId'), -1);
    const code = attr(nf, 'formatCode');
    if (id >= 0 && code) numFmts[id] = code;
  }
  return { fonts, fills, borders, cellXfs, numFmts };
}

/** Parsea `xl/sharedStrings.xml` → array de cadenas. */
export function parseSharedStrings(xml: string): string[] {
  const root = parseXml(xml);
  return kids(root, 'si').map((si) => {
    let out = '';
    const collect = (node: XmlNode) => { for (const c of node.children) { if (c.name === 't') out += c.text; else collect(c); } };
    collect(si);
    return out;
  });
}

/** Celda cruda de una hoja (el valor de sharedString se resuelve en el orquestador). */
export interface XlsxCell { row: number; col: number; styleId: number; type: string; raw: string }
export interface XlsxColInfo { min: number; max: number; width: number }
export interface XlsxMerge { r1: number; c1: number; r2: number; c2: number }
export interface XlsxSheet {
  cells: XlsxCell[]; cols: XlsxColInfo[]; rowHeights: Record<number, number>;
  merges: XlsxMerge[]; maxRow: number; maxCol: number;
}

/** "B12" → { col: 2, row: 12 } (1-based). */
export function parseRef(ref: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return { col: 1, row: 1 };
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(m[2]!, 10) };
}

/** Parsea `xl/worksheets/sheetN.xml` → celdas + geometría + combinaciones. */
export function parseSheet(xml: string): XlsxSheet {
  const root = parseXml(xml);
  const cols: XlsxColInfo[] = kids(child(root, 'cols') ?? { children: [] } as unknown as XmlNode, 'col').map((c) => ({
    min: num(attr(c, 'min'), 1),
    max: num(attr(c, 'max'), 1),
    width: num(attr(c, 'width'), 8.43),
  }));
  const cells: XlsxCell[] = [];
  const rowHeights: Record<number, number> = {};
  let maxRow = 0;
  let maxCol = 0;
  const sheetData = child(root, 'sheetData');
  for (const row of sheetData ? kids(sheetData, 'row') : []) {
    const rNum = num(attr(row, 'r'), 0);
    const ht = attr(row, 'ht');
    if (ht) rowHeights[rNum] = num(ht, 15);
    for (const c of kids(row, 'c')) {
      const ref = attr(c, 'r') ?? '';
      const { col, row: r } = ref ? parseRef(ref) : { col: 1, row: rNum || 1 };
      const type = attr(c, 't') ?? 'n';
      let raw = '';
      if (type === 'inlineStr') {
        const is = child(c, 'is');
        if (is) { const collect = (node: XmlNode) => { for (const k of node.children) { if (k.name === 't') raw += k.text; else collect(k); } }; collect(is); }
      } else {
        raw = child(c, 'v')?.text ?? '';
      }
      cells.push({ row: r, col, styleId: num(attr(c, 's')), type, raw });
      if (r > maxRow) maxRow = r;
      if (col > maxCol) maxCol = col;
    }
  }
  const merges: XlsxMerge[] = [];
  const mc = child(root, 'mergeCells');
  for (const m of mc ? kids(mc, 'mergeCell') : []) {
    const ref = attr(m, 'ref') ?? '';
    const [a, b] = ref.split(':');
    if (a && b) {
      const pa = parseRef(a);
      const pb = parseRef(b);
      merges.push({ r1: pa.row, c1: pa.col, r2: pb.row, c2: pb.col });
    }
  }
  return { cells, cols, rowHeights, merges, maxRow, maxCol };
}

/** Hoja referenciada por el workbook. */
export interface XlsxSheetRef { name: string; path: string }

/** Parsea `xl/workbook.xml` + sus rels → hojas en orden con su ruta de archivo. */
export function parseWorkbook(workbookXml: string, relsXml: string): XlsxSheetRef[] {
  const wb = parseXml(workbookXml);
  const rels = parseXml(relsXml);
  const idToTarget = new Map<string, string>();
  for (const r of kids(rels, 'Relationship')) {
    const id = attr(r, 'Id');
    const target = attr(r, 'Target');
    if (id && target) idToTarget.set(id, target);
  }
  const sheetsParent = child(wb, 'sheets');
  const out: XlsxSheetRef[] = [];
  for (const s of sheetsParent ? kids(sheetsParent, 'sheet') : []) {
    const name = attr(s, 'name') ?? 'Hoja';
    const rid = attr(s, 'r:id') ?? attr(s, 'id') ?? '';
    let target = idToTarget.get(rid) ?? '';
    if (!target) continue;
    target = target.replace(/^\//, '').replace(/^xl\//, '');
    out.push({ name, path: `xl/${target.replace(/^worksheets\//, 'worksheets/')}` });
  }
  return out;
}
