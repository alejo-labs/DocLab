import type { PDFPageProxy } from 'pdfjs-dist';
import type { Span } from './model';

/**
 * Asigna a cada span su color de texto MUESTREANDO los píxeles de la página renderizada
 * (color dominante "con tinta" dentro de la caja del span). Robusto para cualquier espacio
 * de color; defensivo (si falla, los spans quedan sin color = negro por defecto).
 * Requiere navegador (canvas + worker pdf.js).
 */
export async function applyColors(page: PDFPageProxy, spans: Span[]): Promise<void> {
  if (spans.length === 0) return;
  const scale = 1.5;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
  const W = canvas.width;
  const H = canvas.height;
  const data = ctx.getImageData(0, 0, W, H).data;

  for (const s of spans) {
    const x0 = Math.max(0, Math.floor(s.x * scale));
    const y0 = Math.max(0, Math.floor(s.y * scale));
    const x1 = Math.min(W, Math.ceil((s.x + s.w) * scale));
    const y1 = Math.min(H, Math.ceil((s.y + s.h) * scale));
    const hist = new Map<number, number>();
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * W + x) * 4;
        if (data[i + 3]! < 128) continue;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        if ((255 - r) + (255 - g) + (255 - b) < 90) continue; // fondo casi blanco
        const key = ((Math.round(r / 24) * 24) << 16) | ((Math.round(g / 24) * 24) << 8) | (Math.round(b / 24) * 24);
        hist.set(key, (hist.get(key) ?? 0) + 1);
      }
    }
    if (hist.size === 0) continue;
    let best = 0;
    let bestN = -1;
    for (const [k, n] of hist) if (n > bestN) { bestN = n; best = k; }
    const r = (best >> 16) & 255;
    const g = (best >> 8) & 255;
    const b = best & 255;
    if (r < 40 && g < 40 && b < 40) continue; // negro → sin color (por defecto)
    s.color = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
}
