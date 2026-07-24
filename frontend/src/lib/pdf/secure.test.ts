import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { sanitizePdf } from './secure';

async function makeRiskyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setTitle('Documento confidencial');
  doc.setAuthor('Alguien');
  // OpenAction + /Names/JavaScript (vectores que sanitizePdf debe borrar).
  doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({ S: 'JavaScript', JS: '(app.alert(1))' }));
  doc.catalog.set(PDFName.of('Names'), doc.context.obj({ JavaScript: doc.context.obj({ Names: [] }) }));
  return doc.save();
}

describe('sanitizePdf', () => {
  it('elimina JavaScript embebido y lo reporta', async () => {
    const { bytes, report } = await sanitizePdf(await makeRiskyPdf(), { javascript: true, embeddedFiles: false, metadata: false });
    expect(report.javascript).toBe(true);
    const reloaded = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    expect(reloaded.catalog.get(PDFName.of('OpenAction'))).toBeUndefined();
    const names = reloaded.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(names?.get(PDFName.of('JavaScript'))).toBeUndefined();
  });

  it('borra los metadatos cuando se pide', async () => {
    const { bytes, report } = await sanitizePdf(await makeRiskyPdf(), { javascript: false, embeddedFiles: false, metadata: true });
    expect(report.metadata).toBe(true);
    const reloaded = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    expect(reloaded.getTitle() ?? '').toBe('');
    expect(reloaded.getAuthor() ?? '').toBe('');
  });

  it('respeta las opciones desactivadas (no toca JS si javascript:false)', async () => {
    const { report } = await sanitizePdf(await makeRiskyPdf(), { javascript: false, embeddedFiles: false, metadata: false });
    expect(report.javascript).toBe(false);
  });
});
