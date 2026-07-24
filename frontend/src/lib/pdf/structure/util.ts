import type { Span } from './model';

/**
 * Min/max sobre arrays SIN usar spread (`Math.min(...arr)`), que con arrays muy
 * grandes (PDF de decenas de miles de glifos) lanza `RangeError: Maximum call stack`.
 */
export function minOf(arr: number[], fallback = 0): number {
  let m = Infinity;
  for (const v of arr) if (v < m) m = v;
  return Number.isFinite(m) ? m : fallback;
}
export function maxOf(arr: number[], fallback = 0): number {
  let m = -Infinity;
  for (const v of arr) if (v > m) m = v;
  return Number.isFinite(m) ? m : fallback;
}
export function minBy<T>(arr: readonly T[], f: (t: T) => number, fallback = 0): number {
  let m = Infinity;
  for (const t of arr) { const v = f(t); if (v < m) m = v; }
  return Number.isFinite(m) ? m : fallback;
}
export function maxBy<T>(arr: readonly T[], f: (t: T) => number, fallback = 0): number {
  let m = -Infinity;
  for (const t of arr) { const v = f(t); if (v > m) m = v; }
  return Number.isFinite(m) ? m : fallback;
}

/**
 * Sanea los spans a los límites de la página: descarta los que están totalmente
 * fuera o son degenerados (NaN), y RECORTA posiciones/anchuras disparatadas (p. ej.
 * espacios con `width` corrupto de pdf.js que inflarían la caja de contenido y
 * producirían márgenes negativos que rompen la generación de Word). Además limita la
 * anchura de los espacios en blanco a un valor razonable.
 */
export function sanitizeSpans(spans: Span[], W: number, H: number): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    if (![s.x, s.y, s.w, s.h, s.fontSize].every(Number.isFinite)) continue;
    if (s.x > W + 2 || s.x + s.w < -2 || s.y > H + 2 || s.y + s.h < -2) continue; // fuera de página
    const x = Math.max(0, Math.min(s.x, W));
    let right = Math.max(x, Math.min(s.x + s.w, W));
    // Un espacio en blanco no debería medir más que unos pocos cuerpos de fuente.
    if (s.text.trim().length === 0) right = Math.min(right, x + Math.max(4, s.fontSize * 2));
    const y = Math.max(0, Math.min(s.y, H));
    const bottom = Math.max(y, Math.min(s.y + s.h, H));
    out.push({ ...s, x, w: right - x, y, h: bottom - y });
  }
  return out;
}
