import type { Line, Span, Rect } from './model';
import { minBy, maxBy } from './util';

/** Caja de contenido (texto) de la página: min/max de x/y de los spans con texto real. */
export function contentBox(spans: Span[]): Rect {
  const real = spans.filter((s) => s.text.trim().length > 0);
  const use = real.length ? real : spans;
  if (use.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x = minBy(use, (s) => s.x);
  const right = maxBy(use, (s) => s.x + s.w);
  const y = minBy(use, (s) => s.y);
  const bottom = maxBy(use, (s) => s.y + s.h);
  return { x, y, w: right - x, h: bottom - y };
}

function avg(a: number[]): number { return a.reduce((s, v) => s + v, 0) / (a.length || 1); }
function std(a: number[]): number { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) ** 2))); }

/**
 * Alineación de un párrafo respecto a la caja de la columna (left/center/right/justify).
 * box = {x: borde izq de la columna, w: ancho de la columna}.
 */
export function detectAlign(lines: Line[], box: { x: number; w: number }): 'left' | 'center' | 'right' | 'justify' {
  if (lines.length === 0 || box.w <= 0) return 'left';
  const boxLeft = box.x;
  const boxRight = box.x + box.w;
  const tol = Math.max(6, box.w * 0.02);
  const lefts = lines.map((l) => l.x - boxLeft);
  const rights = lines.map((l) => boxRight - (l.x + l.w));

  // Justificado: ≥3 líneas, la mayoría de las NO últimas llegan al borde derecho, y el
  // cuerpo (de la 2ª línea en adelante) está alineado a la izquierda → tolera sangría de 1ª línea.
  if (lines.length >= 3) {
    const nonLast = lines.slice(0, -1);
    const reachRight = nonLast.filter((l) => boxRight - (l.x + l.w) <= tol).length;
    const bodyLines = lines.slice(1);
    const restLeft = minBy(bodyLines, (l) => l.x);
    const bodyLeftAligned = bodyLines.every((l) => Math.abs(l.x - restLeft) <= tol);
    if (reachRight >= Math.ceil(nonLast.length * 0.7) && bodyLeftAligned) return 'justify';
  }

  const leftStd = std(lefts);
  const rightStd = std(rights);
  const avgLeft = avg(lefts);
  const avgRight = avg(rights);

  // Centrado: márgenes izq/dcho simétricos en cada línea y con hueco por ambos lados.
  const symmetric = lines.every((l) => Math.abs((l.x - boxLeft) - (boxRight - (l.x + l.w))) <= Math.max(10, box.w * 0.06));
  if (symmetric && avgLeft > tol && avgRight > tol) return 'center';

  // Derecha: bordes derechos muy alineados, izquierda claramente irregular y el texto
  // realmente desplazado a la derecha (evita confundir párrafos cortos o justificados).
  if (rightStd <= tol && leftStd > tol * 2 && avgLeft > box.w * 0.12) return 'right';

  return 'left';
}

/** Sangría de primera línea (pt): cuánto empieza más a la derecha que el resto del párrafo. */
export function firstLineIndent(lines: Line[]): number {
  if (lines.length < 2) return 0;
  const restLeft = minBy(lines.slice(1), (l) => l.x);
  const indent = lines[0]!.x - restLeft;
  return indent > 3 ? Math.round(indent) : 0;
}

/** Interlineado como ratio (1.0/1.15/1.5/2.0), por la mediana de saltos baseline. */
export function lineSpacing(lines: Line[]): number | undefined {
  if (lines.length < 2) return undefined;
  const ys = lines.map((l) => l.y).sort((a, b) => a - b);
  const deltas: number[] = [];
  for (let i = 1; i < ys.length; i += 1) deltas.push(ys[i]! - ys[i - 1]!);
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)]!;
  const fontSize = avg(lines.map((l) => l.fontSize)) || 12;
  const ratio = median / fontSize;
  const snaps = [1, 1.15, 1.5, 2];
  let best = 1;
  let bestD = Infinity;
  for (const s of snaps) { const d = Math.abs(ratio - s); if (d < bestD) { bestD = d; best = s; } }
  return best === 1 ? undefined : best;
}
