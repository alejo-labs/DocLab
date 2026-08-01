import { PDFDocument, degrees } from 'pdf-lib';

export interface PagePlan {
  /** Índice de la página en el documento ORIGINAL (base 0). */
  sourceIndex: number;
  /** Rotación absoluta a aplicar, en grados (0, 90, 180, 270). */
  rotation: number;
}

/**
 * Reconstruye un PDF a partir de un "plan" de páginas: define el nuevo orden,
 * qué páginas se conservan (las eliminadas simplemente no están en el plan) y la
 * rotación de cada una.
 */
export async function rebuildPdf(bytes: Uint8Array, plan: PagePlan[]): Promise<Uint8Array> {
  if (plan.length === 0) {
    throw new Error('El documento debe conservar al menos una página.');
  }

  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();

  const copied = await out.copyPages(
    src,
    plan.map((item) => item.sourceIndex),
  );

  copied.forEach((page, position) => {
    const planItem = plan[position];
    if (planItem && planItem.rotation % 360 !== 0) {
      // Sumamos a la rotación que ya trajera la página.
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + planItem.rotation) % 360));
    }
    out.addPage(page);
  });

  out.setProducer('DocLab');
  return out.save();
}

/** Normaliza un ángulo a 0/90/180/270. */
export function normalizeRotation(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
