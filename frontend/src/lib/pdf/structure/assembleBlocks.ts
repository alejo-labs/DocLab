import type { Span, Line, Block, Rect } from './model';
import { assembleLines } from './assembleLines';
import { detectAlign, firstLineIndent, lineSpacing } from './layout';
import { minBy, maxBy } from './util';

const LIST_RE = /^\s*([•·▪◦‣*–—-]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;

/** Quita la viñeta/numeración inicial de un ítem de lista. */
export function stripMarker(text: string): string {
  return text.replace(LIST_RE, '').trim();
}

/** Moda ponderada (por nº de caracteres) del tamaño de fuente → tamaño del CUERPO. */
function bodySizeFromSpans(spans: Span[]): number {
  const weight = new Map<number, number>();
  for (const s of spans) {
    const key = Math.round(s.fontSize * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + Math.max(1, s.text.trim().length));
  }
  let size = 12;
  let best = -1;
  for (const [k, w] of weight) if (w > best) { best = w; size = k; }
  return size || 12;
}

function bbox(lines: Line[]): Rect {
  const x = minBy(lines, (l) => l.x);
  const right = maxBy(lines, (l) => l.x + l.w);
  const y = minBy(lines, (l) => l.y);
  const bottom = maxBy(lines, (l) => l.y + l.h);
  return { x, y, w: right - x, h: bottom - y };
}

function classify(lines: Line[], body: number, colBox: { x: number; w: number }): Block {
  const box = bbox(lines);
  const size = maxBy(lines, (l) => l.fontSize, 12);
  const isBold = lines.every((l) => l.bold);
  const listMatches = lines.filter((l) => LIST_RE.test(l.text)).length;
  const attrs = {
    align: detectAlign(lines, colBox),
    indentFirst: firstLineIndent(lines),
    indentLeft: box.x - colBox.x > 3 ? Math.round(box.x - colBox.x) : undefined,
    lineSpacing: lineSpacing(lines),
  };

  if (lines.length >= 2 && listMatches >= Math.ceil(lines.length * 0.6)) {
    const ordered = /^\s*\d/.test(lines[0]!.text);
    return { kind: 'list', items: lines, ordered, ...box };
  }
  if (lines.length <= 2 && (size >= body * 1.15 || (isBold && size >= body * 1.05))) {
    const level = size >= body * 1.6 ? 1 : size >= body * 1.3 ? 2 : 3;
    return { kind: 'heading', level, lines, ...box, ...attrs };
  }
  return { kind: 'paragraph', lines, ...box, ...attrs };
}

/** Agrupa las líneas de UNA columna en bloques por hueco vertical / cambio de tamaño. */
function blocksInColumn(colSpans: Span[], body: number): Block[] {
  const lines = assembleLines(colSpans);
  if (lines.length === 0) return [];
  const cbLeft = minBy(lines, (l) => l.x);
  const cbRight = maxBy(lines, (l) => l.x + l.w);
  const colBox = { x: cbLeft, w: cbRight - cbLeft };
  const groups: Line[][] = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last) {
      const prev = last[last.length - 1]!;
      const gap = l.y - (prev.y + prev.h);
      const sizeJump = Math.max(l.fontSize, prev.fontSize) / Math.min(l.fontSize, prev.fontSize) > 1.15;
      if (gap <= prev.h * 0.8 && !sizeJump) { last.push(l); continue; }
    }
    groups.push([l]);
  }
  return groups.map((g) => classify(g, body, colBox));
}

/** Encuentra el corte de columna (gutter) con menos cruces; null si es 1 columna. */
function findColumnCut(spans: Span[], pageWidth: number): number | null {
  const total = spans.length;
  let best: number | null = null;
  let bestCross = Infinity;
  for (let cut = pageWidth * 0.3; cut <= pageWidth * 0.7; cut += 4) {
    const cross = spans.filter((s) => s.x < cut && s.x + s.w > cut).length;
    const left = spans.filter((s) => s.x + s.w / 2 < cut).length;
    const right = total - left;
    if (left >= 3 && right >= 3 && cross < bestCross) { bestCross = cross; best = cut; }
  }
  return best != null && bestCross <= total * 0.05 ? best : null;
}

/**
 * Spans → bloques (párrafo/título/lista) con detección de columnas y orden de lectura.
 * Detecta columnas A NIVEL DE SPANS (antes de formar líneas) para no fusionar columnas.
 * Función pura (testeable en Node). Tablas e imágenes se mezclan después por posición.
 */
export function assembleBlocks(spans: Span[], pageWidth: number): Block[] {
  const valid = spans.filter((s) => s.text && s.text.trim().length > 0);
  if (valid.length === 0) return [];
  const body = bodySizeFromSpans(valid);
  const cut = findColumnCut(valid, pageWidth);
  if (cut != null) {
    const left = valid.filter((s) => s.x + s.w / 2 < cut);
    const right = valid.filter((s) => s.x + s.w / 2 >= cut);
    return [...blocksInColumn(left, body), ...blocksInColumn(right, body)];
  }
  return blocksInColumn(valid, body);
}
