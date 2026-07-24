import { describe, it, expect } from 'vitest';
import { detectHeaderFooter } from './detectHeaderFooter';
import type { Block, Line, Page } from './model';

const line = (text: string): Line => ({ spans: [], text, x: 0, y: 0, w: 100, h: 10, fontSize: 10, bold: false, italic: false });
const para = (text: string, y: number): Block => ({ kind: 'paragraph', lines: [line(text)], x: 0, y, w: 100, h: 10 });
const page = (blocks: Block[]): Page => ({ width: 400, height: 800, blocks }); // banda sup ≤96, inf ≥704

describe('detectHeaderFooter', () => {
  it('conserva la 1ª aparición del encabezado y quita las repeticiones; quita todos los pies repetidos', () => {
    const pages: Page[] = [];
    for (let n = 1; n <= 4; n += 1) {
      pages.push(page([
        para('PEC3 Comportamiento humano', 10), // encabezado repetido (banda superior)
        para(`contenido único de la página ${n}`, 400), // cuerpo
        para(`Página ${n} de 4`, 750), // pie con nº de página (banda inferior)
      ]));
    }
    const res = detectHeaderFooter(pages);
    expect(res).toEqual({}); // no se exporta al Header/Footer de Word

    // Página 1: conserva el encabezado (1ª aparición) + cuerpo; el pie se quita.
    const p1Texts = pages[0]!.blocks.map((b) => ('lines' in b ? b.lines[0]!.text : ''));
    expect(p1Texts).toContain('PEC3 Comportamiento humano');
    expect(p1Texts.some((t) => t.startsWith('Página'))).toBe(false);

    // Página 2: encabezado repetido eliminado; pie eliminado; solo queda el cuerpo.
    const p2Texts = pages[1]!.blocks.map((b) => ('lines' in b ? b.lines[0]!.text : ''));
    expect(p2Texts).not.toContain('PEC3 Comportamiento humano');
    expect(p2Texts).toHaveLength(1);
    expect(p2Texts[0]).toContain('contenido único');
  });

  it('con <3 páginas no toca nada', () => {
    const pages = [page([para('Header', 10)]), page([para('Header', 10)])];
    detectHeaderFooter(pages);
    expect(pages[0]!.blocks).toHaveLength(1);
  });
});
