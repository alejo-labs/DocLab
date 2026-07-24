import { describe, it, expect } from 'vitest';
import { parseRef, parseSharedStrings, parseStyles, parseSheet, parseWorkbook } from './xlsxModel';

describe('parseRef', () => {
  it('convierte referencias A1 a col/row 1-based', () => {
    expect(parseRef('A1')).toEqual({ col: 1, row: 1 });
    expect(parseRef('B12')).toEqual({ col: 2, row: 12 });
    expect(parseRef('AA1').col).toBe(27);
    expect(parseRef('AB3')).toEqual({ col: 28, row: 3 });
  });
  it('referencia inválida → A1', () => {
    expect(parseRef('???')).toEqual({ col: 1, row: 1 });
  });
});

describe('parseSharedStrings', () => {
  it('lee cadenas simples y rich-text (varios <r><t>)', () => {
    const xml = '<sst><si><t>Hola</t></si><si><r><t>Mun</t></r><r><t>do</t></r></si></sst>';
    expect(parseSharedStrings(xml)).toEqual(['Hola', 'Mundo']);
  });
});

describe('parseStyles', () => {
  it('resuelve fuente en negrita, color e xf con alineación', () => {
    const xml = `<styleSheet>
      <fonts><font><sz val="14"/><b/><color rgb="FFFF0000"/><name val="Arial"/></font></fonts>
      <fills><fill><patternFill patternType="solid"><fgColor rgb="FF00FF00"/></patternFill></fill></fills>
      <cellXfs><xf fontId="0" fillId="0" numFmtId="0"><alignment horizontal="center" wrapText="1"/></xf></cellXfs>
    </styleSheet>`;
    const s = parseStyles(xml);
    expect(s.fonts[0]).toMatchObject({ size: 14, bold: true, italic: false, color: '#FF0000', name: 'Arial' });
    expect(s.fills[0]).toBe('#00FF00');
    expect(s.cellXfs[0]).toMatchObject({ hAlign: 'center', wrap: true });
  });
});

describe('parseSheet', () => {
  it('lee celdas, dimensiones y combinaciones', () => {
    const xml = `<worksheet>
      <cols><col min="1" max="1" width="20"/></cols>
      <sheetData>
        <row r="1" ht="30"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>42</v></c></row>
        <row r="2"><c r="A2" t="inlineStr"><is><t>en línea</t></is></c></row>
      </sheetData>
      <mergeCells><mergeCell ref="A1:B1"/></mergeCells>
    </worksheet>`;
    const sh = parseSheet(xml);
    expect(sh.maxRow).toBe(2);
    expect(sh.maxCol).toBe(2);
    expect(sh.cols[0]!.width).toBe(20);
    expect(sh.rowHeights[1]).toBe(30);
    expect(sh.cells.find((c) => c.row === 2 && c.col === 1)!.raw).toBe('en línea');
    expect(sh.merges[0]).toEqual({ r1: 1, c1: 1, r2: 1, c2: 2 });
  });
});

describe('parseWorkbook', () => {
  it('resuelve el orden de hojas vía relaciones r:id', () => {
    const wb = '<workbook><sheets><sheet name="Datos" r:id="rId1"/><sheet name="Resumen" r:id="rId2"/></sheets></workbook>';
    const rels = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>';
    const refs = parseWorkbook(wb, rels);
    expect(refs).toEqual([
      { name: 'Datos', path: 'xl/worksheets/sheet1.xml' },
      { name: 'Resumen', path: 'xl/worksheets/sheet2.xml' },
    ]);
  });
});
