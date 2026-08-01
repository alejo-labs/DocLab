import type { Span, Line } from './model';
import { minBy, maxBy } from './util';

function modeBy<T>(items: T[], key: (t: T) => string | undefined, weight: (t: T) => number): string | undefined {
  const w = new Map<string, number>();
  for (const it of items) { const k = key(it); if (k) w.set(k, (w.get(k) ?? 0) + weight(it)); }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of w) if (n > bestN) { bestN = n; best = k; }
  return best;
}

/** Tamaño/estilo/color/familia dominantes de un conjunto de spans, ponderado por caracteres. */
function dominant(spans: Span[]): { fontSize: number; bold: boolean; italic: boolean; color?: string; fontFamily?: string } {
  const sizeWeight = new Map<number, number>();
  let boldChars = 0;
  let italicChars = 0;
  let total = 0;
  for (const s of spans) {
    const len = Math.max(1, s.text.trim().length);
    const key = Math.round(s.fontSize * 2) / 2;
    sizeWeight.set(key, (sizeWeight.get(key) ?? 0) + len);
    if (s.bold) boldChars += len;
    if (s.italic) italicChars += len;
    total += len;
  }
  let fontSize = spans[0]?.fontSize ?? 12;
  let best = -1;
  for (const [size, w] of sizeWeight) if (w > best) { best = w; fontSize = size; }
  const len = (s: Span) => Math.max(1, s.text.trim().length);
  return {
    fontSize,
    bold: boldChars > total / 2,
    italic: italicChars > total / 2,
    color: modeBy(spans, (s) => s.color, len),
    fontFamily: modeBy(spans, (s) => s.fontFamily, len),
  };
}

function finalizeLine(spans: Span[]): Line {
  const ordered = [...spans].sort((a, b) => a.x - b.x);
  let text = '';
  let prevRight: number | null = null;
  for (const s of ordered) {
    if (prevRight !== null) {
      const gap = s.x - prevRight;
      // Inserta un espacio si hay hueco apreciable y el span no empieza ya por espacio.
      if (gap > s.fontSize * 0.22 && !/^\s/.test(s.text) && !/\s$/.test(text)) text += ' ';
    }
    text += s.text;
    prevRight = s.x + s.w;
  }
  const x = minBy(ordered, (s) => s.x);
  const right = maxBy(ordered, (s) => s.x + s.w);
  const y = minBy(ordered, (s) => s.y);
  const bottom = maxBy(ordered, (s) => s.y + s.h);
  const dom = dominant(ordered);
  return { spans: ordered, text: text.replace(/\s+/g, ' ').trim(), x, y, w: right - x, h: bottom - y, ...dom };
}

/**
 * Agrupa spans en líneas por proximidad vertical (función pura, testeable en Node).
 * Devuelve las líneas ordenadas de arriba a abajo.
 */
export function assembleLines(spans: Span[]): Line[] {
  const valid = spans.filter((s) => s.text && s.text.trim().length > 0);
  if (valid.length === 0) return [];
  // Ordena por centro vertical, luego x.
  const sorted = [...valid].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);

  const groups: Span[][] = [];
  for (const s of sorted) {
    const cy = s.y + s.h / 2;
    const last = groups[groups.length - 1];
    if (last) {
      // centro vertical de la línea actual
      const ly = last.reduce((sum, t) => sum + (t.y + t.h / 2), 0) / last.length;
      const tol = Math.min(s.h, last[0]!.h) * 0.6;
      if (Math.abs(cy - ly) <= tol) { last.push(s); continue; }
    }
    groups.push([s]);
  }

  return groups.map(finalizeLine).sort((a, b) => a.y - b.y);
}
