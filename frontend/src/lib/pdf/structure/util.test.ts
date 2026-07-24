import { describe, it, expect } from 'vitest';
import { minOf, maxOf, minBy, maxBy, sanitizeSpans } from './util';
import type { Span } from './model';

const sp = (over: Partial<Span>): Span => ({ text: 'a', x: 10, y: 10, w: 20, h: 12, fontSize: 12, bold: false, italic: false, fontFamily: 'x', ...over });

describe('min/max sin spread', () => {
  it('minOf/maxOf', () => {
    expect(minOf([3, 1, 2])).toBe(1);
    expect(maxOf([3, 1, 2])).toBe(4 - 1);
    expect(minOf([], 99)).toBe(99); // fallback en vacío
  });
  it('minBy/maxBy', () => {
    const a = [{ v: 5 }, { v: 2 }, { v: 9 }];
    expect(minBy(a, (x) => x.v)).toBe(2);
    expect(maxBy(a, (x) => x.v)).toBe(9);
  });
  it('no revienta con arrays enormes (el bug del spread)', () => {
    const big = Array.from({ length: 200_000 }, (_, i) => i);
    expect(() => minOf(big)).not.toThrow();
    expect(maxOf(big)).toBe(199_999);
  });
});

describe('sanitizeSpans (fix del crash PDF→Word)', () => {
  const W = 612;
  const H = 792;
  it('conserva un span normal', () => {
    const out = sanitizeSpans([sp({ text: 'hola', x: 50, w: 100 })], W, H);
    expect(out).toHaveLength(1);
    expect(out[0]!.w).toBe(100);
  });
  it('recorta a la página un espacio con anchura corrupta', () => {
    const out = sanitizeSpans([sp({ text: ' ', x: 189, w: 6198, fontSize: 12 })], W, H);
    expect(out[0]!.x + out[0]!.w).toBeLessThanOrEqual(W);
    expect(out[0]!.w).toBeLessThanOrEqual(24); // espacio: máx ~2× fontSize
  });
  it('descarta spans totalmente fuera de página', () => {
    expect(sanitizeSpans([sp({ x: 5000, w: 20 })], W, H)).toHaveLength(0);
  });
  it('descarta spans con coordenadas no finitas', () => {
    expect(sanitizeSpans([sp({ x: NaN })], W, H)).toHaveLength(0);
  });
});
