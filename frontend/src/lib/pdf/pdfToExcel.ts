import { extractStructure, type PageRange } from './structure/extractStructure';
import { sanitizeXml } from './structure/sanitize';
import { zipStore } from './zipStore';
import type { TableModel } from './structure/model';

/**
 * PDF → Excel (.xlsx) on-device. Usa el análisis de layout: cada TABLA detectada
 * (con o sin bordes) va a SU PROPIA hoja; el texto no tabular a una hoja "Texto".
 * Genera un .xlsx multi-hoja a mano + zipStore (zip clásico que Office acepta).
 */
function colLetter(n: number): string {
  let s = '';
  let v = n;
  while (v > 0) { const m = (v - 1) % 26; s = String.fromCharCode(65 + m) + s; v = Math.floor((v - 1) / 26); }
  return s;
}
function esc(s: string): string {
  return sanitizeXml(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeName(name: string, used: Set<string>): string {
  let base = name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 28).trim() || 'Hoja';
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) { n = `${base.slice(0, 25)} ${i}`; i += 1; }
  used.add(n.toLowerCase());
  return n;
}

interface Sheet { name: string; rows: string[][]; colWidths?: number[] }

function sheetXml(sheet: Sheet): string {
  const cols = sheet.colWidths?.length
    ? `<cols>${sheet.colWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(6, Math.min(80, w / 6)).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
    : '';
  let sd = '';
  sheet.rows.forEach((cells, r) => {
    const rn = r + 1;
    let rx = `<row r="${rn}">`;
    cells.forEach((val, ci) => {
      const ref = `${colLetter(ci + 1)}${rn}`;
      const t = val.trim();
      const isNum = /^-?\d+([.,]\d+)?$/.test(t);
      rx += isNum
        ? `<c r="${ref}"><v>${Number(t.replace(',', '.'))}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(val)}</t></is></c>`;
    });
    rx += '</row>';
    sd += rx;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sd}</sheetData></worksheet>`;
}

export async function pdfToExcel(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
  range?: PageRange,
): Promise<Blob> {
  const doc = await extractStructure(bytes, onProgress, range);
  const used = new Set<string>();
  const sheets: Sheet[] = [];
  const textRows: string[][] = [];
  let tableIdx = 1;

  for (const page of doc.pages) {
    for (const b of page.blocks) {
      if (b.kind === 'table') {
        const tm: TableModel = b.table;
        sheets.push({ name: safeName(`Tabla ${tableIdx}`, used), rows: tm.rows, colWidths: tm.colWidths });
        tableIdx += 1;
      } else if (b.kind === 'paragraph') {
        for (const l of b.lines) textRows.push([l.text]);
      } else if (b.kind === 'heading') {
        textRows.push([b.lines.map((l) => l.text).join(' ')]);
      } else if (b.kind === 'list') {
        for (const l of b.items) textRows.push([l.text]);
      }
    }
    textRows.push([]);
  }
  if (textRows.some((r) => r.length)) sheets.push({ name: safeName('Texto', used), rows: textRows });
  if (sheets.length === 0) sheets.push({ name: 'Hoja1', rows: [['(sin contenido)']] });

  // Ensamblado del paquete OOXML multi-hoja.
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const overrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const contentTypes = `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`;
  const rels = `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const sheetTags = sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const workbook = `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
  const wbRels = `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;

  const enc = new TextEncoder();
  const entries = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) })),
  ];
  return new Blob([zipStore(entries) as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
