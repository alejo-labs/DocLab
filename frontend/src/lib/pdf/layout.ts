import { StandardFonts } from 'pdf-lib';
import type { FontFamily } from './annotations';

export type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

/** Esquina inferior-izquierda (coords PDF) para un elemento w×h en una posición. */
export function anchorBottomLeft(pos: Position, pageW: number, pageH: number, w: number, h: number, margin: number) {
  let x = margin;
  if (pos.endsWith('center')) x = (pageW - w) / 2;
  else if (pos.endsWith('right')) x = pageW - margin - w;

  let y = margin; // abajo por defecto
  if (pos.startsWith('top')) y = pageH - margin - h;
  else if (pos.startsWith('center')) y = (pageH - h) / 2;

  return { x, y };
}

/** Fuente estándar (peso normal) para una familia. */
export function standardFont(family: FontFamily): StandardFonts {
  if (family === 'times') return StandardFonts.TimesRoman;
  if (family === 'courier') return StandardFonts.Courier;
  return StandardFonts.Helvetica;
}

/** Parsea "1-3, 5, 8-10" a un Set de páginas 1-based, acotado a pageCount. */
export function parsePages(expr: string, pageCount: number): Set<number> {
  const out = new Set<number>();
  for (const part of expr.split(',').map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = part.match(/^(\d+)$/);
    if (range) {
      const a = Math.max(1, Number(range[1]));
      const b = Math.min(pageCount, Number(range[2]));
      for (let i = a; i <= b; i += 1) out.add(i);
    } else if (single) {
      const n = Number(single[1]);
      if (n >= 1 && n <= pageCount) out.add(n);
    }
  }
  return out;
}
