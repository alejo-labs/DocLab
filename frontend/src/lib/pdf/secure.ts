import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';

/**
 * Saneado de PDF, 100% en el navegador con pdf-lib. Elimina vectores de riesgo y
 * rastros de privacidad sin que el archivo salga del dispositivo:
 * - JavaScript embebido (OpenAction, /Names/JavaScript, /AA de página y anotación, XFA).
 * - Archivos adjuntos/incrustados (/Names/EmbeddedFiles).
 * - Metadatos (Info del documento + flujo XMP /Metadata).
 */
export interface SanitizeOptions { javascript: boolean; embeddedFiles: boolean; metadata: boolean }
export interface SanitizeReport { javascript: boolean; embeddedFiles: number; metadata: boolean }

const N = (s: string) => PDFName.of(s);

export async function sanitizePdf(
  bytes: Uint8Array,
  options: SanitizeOptions,
): Promise<{ bytes: Uint8Array; report: SanitizeReport }> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const catalog = doc.catalog;
  const report: SanitizeReport = { javascript: false, embeddedFiles: 0, metadata: false };

  if (options.javascript) {
    if (catalog.get(N('OpenAction'))) { catalog.delete(N('OpenAction')); report.javascript = true; }
    const names = catalog.lookupMaybe(N('Names'), PDFDict);
    if (names?.get(N('JavaScript'))) { names.delete(N('JavaScript')); report.javascript = true; }
    const acro = catalog.lookupMaybe(N('AcroForm'), PDFDict);
    if (acro?.get(N('XFA'))) { acro.delete(N('XFA')); report.javascript = true; }
    for (const page of doc.getPages()) {
      const pn = page.node;
      if (pn.get(N('AA'))) { pn.delete(N('AA')); report.javascript = true; }
      const annots = pn.lookupMaybe(N('Annots'), PDFArray);
      if (annots) {
        for (let i = 0; i < annots.size(); i += 1) {
          const a = annots.lookupMaybe(i, PDFDict);
          if (!a) continue;
          if (a.get(N('AA'))) { a.delete(N('AA')); report.javascript = true; }
          const action = a.lookupMaybe(N('A'), PDFDict);
          if (action && action.get(N('S')) === N('JavaScript')) { a.delete(N('A')); report.javascript = true; }
        }
      }
    }
  }

  if (options.embeddedFiles) {
    const names = catalog.lookupMaybe(N('Names'), PDFDict);
    const ef = names?.lookupMaybe(N('EmbeddedFiles'), PDFDict);
    if (ef) {
      const arr = ef.lookupMaybe(N('Names'), PDFArray);
      report.embeddedFiles = arr ? Math.max(1, Math.floor(arr.size() / 2)) : 1;
      names!.delete(N('EmbeddedFiles'));
    }
    // Archivos asociados a nivel de documento (PDF 2.0 /AF).
    if (catalog.get(N('AF'))) catalog.delete(N('AF'));
  }

  if (options.metadata) {
    if (catalog.get(N('Metadata'))) { catalog.delete(N('Metadata')); }
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('');
    doc.setCreator('');
    report.metadata = true;
  }

  // load usó updateMetadata:false → no se re-inyectan Producer/ModDate.
  const out = await doc.save({ useObjectStreams: true });
  return { bytes: out, report };
}
