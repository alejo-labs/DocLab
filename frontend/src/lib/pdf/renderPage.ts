import type { PDFPageProxy } from 'pdfjs-dist';

/** Renderiza una página pdf.js a un canvas con fondo blanco, a la escala dada (solo navegador). */
export async function renderPageToCanvas(page: PDFPageProxy, scale: number): Promise<HTMLCanvasElement> {
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto de canvas.');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

/** Canvas → JPEG (Uint8Array). */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('No se pudo generar el JPEG.'))),
      'image/jpeg',
      quality,
    );
  });
}
