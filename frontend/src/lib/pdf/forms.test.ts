import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addFields, readFields, fillFields } from './forms';

async function blankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  return doc.save();
}

describe('addFields + readFields', () => {
  it('crea campos de todos los tipos y se leen de vuelta', async () => {
    const out = await addFields(await blankPdf(), [
      { kind: 'text', name: 'nombre', page: 0, x: 50, y: 50, width: 200, height: 24, required: true, fontSize: 12, textColor: '#112233', align: 'center' },
      { kind: 'textarea', name: 'notas', page: 0, x: 50, y: 100, width: 200, height: 80 },
      { kind: 'checkbox', name: 'acepto', page: 0, x: 50, y: 200, width: 16, height: 16 },
      { kind: 'dropdown', name: 'pais', page: 0, x: 50, y: 230, width: 120, height: 24, options: ['ES', 'MX', 'AR'] },
    ]);
    const fields = await readFields(out);
    const by = (n: string) => fields.find((f) => f.name === n)!;

    expect(by('nombre').type).toBe('text');
    expect(by('nombre').required).toBe(true);
    expect(by('notas').type).toBe('text');
    expect(by('notas').multiline).toBe(true);
    expect(by('acepto').type).toBe('checkbox');
    expect(by('pais').type).toBe('dropdown');
    expect(by('pais').options).toEqual(['ES', 'MX', 'AR']);
  });

  it('los nombres duplicados no colisionan (se renombra el segundo)', async () => {
    const out = await addFields(await blankPdf(), [
      { kind: 'text', name: 'campo', page: 0, x: 50, y: 50, width: 100, height: 20 },
      { kind: 'text', name: 'campo', page: 0, x: 50, y: 90, width: 100, height: 20 },
    ]);
    const names = (await readFields(out)).map((f) => f.name);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it('fillFields escribe el valor de un campo de texto', async () => {
    const withFields = await addFields(await blankPdf(), [
      { kind: 'text', name: 'nombre', page: 0, x: 50, y: 50, width: 200, height: 24 },
    ]);
    const filled = await fillFields(withFields, { nombre: 'DocLab' });
    expect((await readFields(filled)).find((f) => f.name === 'nombre')!.value).toBe('DocLab');
  });
});
