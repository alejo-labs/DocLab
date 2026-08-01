import { describe, it, expect } from 'vitest';
import { detectTablesStream } from './detectTablesStream';
import type { Span } from './model';

const sp = (text: string, x: number, y: number, w = Math.max(6, text.length * 7)): Span => ({ text, x, y, w, h: 12, fontSize: 12, bold: false, italic: false, fontFamily: 'x' });

describe('detectTablesStream', () => {
  it('detecta una tabla real de 3 columnas', () => {
    const spans: Span[] = [];
    for (let r = 0; r < 4; r += 1) {
      const y = r * 20;
      spans.push(sp(`A${r}`, 100, y), sp(`B${r}`, 260, y), sp(`C${r}`, 420, y));
    }
    const { tables } = detectTablesStream(spans);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.table.cols).toBe(3);
    expect(tables[0]!.table.rows).toHaveLength(4);
  });

  it('NO detecta una lista con viñetas como tabla (regresión reportada)', () => {
    const spans: Span[] = [];
    for (let r = 0; r < 3; r += 1) {
      const y = r * 20;
      spans.push(sp('•', 100, y, 8), sp(`elemento ${r} de la lista con texto`, 130, y, 200));
    }
    const { tables } = detectTablesStream(spans);
    expect(tables).toHaveLength(0);
  });

  it('las tablas sin bordes se marcan bordered:false', () => {
    const spans: Span[] = [];
    for (let r = 0; r < 4; r += 1) { const y = r * 20; spans.push(sp(`X${r}`, 100, y), sp(`Y${r}`, 260, y), sp(`Z${r}`, 420, y)); }
    const { tables } = detectTablesStream(spans);
    expect(tables[0]!.table.bordered).toBe(false);
  });
});
