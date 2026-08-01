import { describe, it, expect } from 'vitest';
import { diffWords, alignParagraphs } from './wordDiff';

describe('diffWords', () => {
  it('detecta borrados y añadidos, manteniendo lo igual', () => {
    const ops = diffWords('el gato negro come pescado fresco', 'el gato blanco come pescado');
    const by = (type: string) => ops.filter((o) => o.type === type).map((o) => o.text).join(' ');
    expect(by('del')).toContain('negro');
    expect(by('del')).toContain('fresco');
    expect(by('add')).toContain('blanco');
    expect(by('eq')).toContain('gato');
  });
  it('textos idénticos → todo eq', () => {
    expect(diffWords('mismo texto aqui', 'mismo texto aqui').every((o) => o.type === 'eq')).toBe(true);
  });
  it('vacío vs texto → add', () => {
    expect(diffWords('', 'hola mundo').every((o) => o.type === 'add')).toBe(true);
  });
});

describe('alignParagraphs', () => {
  it('párrafos idénticos → sin cambios (regresión reportada)', () => {
    const r = alignParagraphs(['hola que tal', 'segundo parrafo'], ['hola que tal', 'segundo parrafo']);
    expect(r.every((p) => !p.changed)).toBe(true);
  });
  it('cambio de una palabra → word-diff dentro del párrafo', () => {
    const r = alignParagraphs(['el gato negro come pescado fresco hoy'], ['el gato blanco come pescado fresco hoy']);
    expect(r).toHaveLength(1);
    expect(r[0]!.changed).toBe(true);
    expect(r[0]!.ops.some((o) => o.type === 'del' && o.text.includes('negro'))).toBe(true);
  });
  it('inserción de un párrafo intermedio', () => {
    const r = alignParagraphs(
      ['parrafo uno aaa bbb', 'parrafo dos ccc ddd'],
      ['parrafo uno aaa bbb', 'NUEVO parrafo intermedio', 'parrafo dos ccc ddd'],
    );
    expect(r).toHaveLength(3);
    expect(r[1]!.ops[0]!.type).toBe('add');
    expect(r[0]!.changed).toBe(false);
    expect(r[2]!.changed).toBe(false);
  });
});
