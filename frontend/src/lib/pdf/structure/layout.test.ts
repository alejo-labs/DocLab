import { describe, it, expect } from 'vitest';
import { detectAlign, firstLineIndent, lineSpacing, contentBox } from './layout';
import type { Line, Span } from './model';

const L = (x: number, w: number, y = 0, fontSize = 12): Line => ({ spans: [], text: 'x', x, y, w, h: fontSize, fontSize, bold: false, italic: false });
const box = { x: 100, w: 400 }; // borde derecho en 500

describe('detectAlign', () => {
  it('justificado con sangría de 1ª línea → justify (regresión reportada)', () => {
    expect(detectAlign([L(120, 380), L(100, 400), L(100, 400), L(100, 150)], box)).toBe('justify');
  });
  it('derecha → right', () => {
    expect(detectAlign([L(300, 200), L(250, 250), L(350, 150)], box)).toBe('right');
  });
  it('centro → center', () => {
    expect(detectAlign([L(200, 200), L(180, 240), L(220, 160)], box)).toBe('center');
  });
  it('izquierda → left', () => {
    expect(detectAlign([L(100, 400), L(100, 250), L(100, 300), L(100, 150)], box)).toBe('left');
  });
  it('línea única corta a la izquierda → left (no right)', () => {
    expect(detectAlign([L(100, 200)], box)).toBe('left');
  });
});

describe('firstLineIndent', () => {
  it('detecta sangría de 1ª línea', () => {
    expect(firstLineIndent([L(120, 380), L(100, 400), L(100, 400)])).toBe(20);
  });
  it('sin sangría → 0', () => {
    expect(firstLineIndent([L(100, 400), L(100, 400)])).toBe(0);
  });
});

describe('lineSpacing', () => {
  it('interlineado doble → 2', () => {
    expect(lineSpacing([L(100, 400, 0), L(100, 400, 24), L(100, 400, 48)])).toBe(2);
  });
  it('interlineado simple → undefined', () => {
    expect(lineSpacing([L(100, 400, 0), L(100, 400, 12), L(100, 400, 24)])).toBeUndefined();
  });
});

describe('contentBox', () => {
  it('ignora espacios en blanco con anchura basura y usa el texto real', () => {
    const s = (text: string, x: number, w: number): Span => ({ text, x, y: 100, w, h: 12, fontSize: 12, bold: false, italic: false, fontFamily: 'x' });
    const cb = contentBox([s('A', 50, 20), s(' ', 10, 5000), s('B', 200, 20)]);
    expect(cb.x).toBe(50);
    expect(cb.w).toBe(170); // 220 - 50; el espacio de 5000 se ignora
  });
});
