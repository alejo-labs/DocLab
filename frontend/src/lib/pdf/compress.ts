import { PDFDocument } from 'pdf-lib';
import { OPS } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import { createPdfLoadingTask } from './pdfjs';
import { renderPageToCanvas, canvasToJpeg } from './renderPage';
import { optimizeImagesInDoc } from './optimizeImages';

export type CompressionLevel = 'screen' | 'ebook' | 'printer';

interface LevelConfig {
  scale: number; // resolución de rasterizado de páginas escaneadas
  quality: number; // calidad JPEG (raster de escaneados)
  maxDim: number; // techo de píxeles (lado mayor) para imágenes embebidas
  imgQuality: number; // calidad JPEG al recomprimir imágenes embebidas
  rasterizeAll: boolean; // máxima: convierte TODAS las páginas a imagen (pierde texto, máxima reducción)
}

// Perfiles inspirados en los de Ghostscript (-dPDFSETTINGS).
const LEVELS: Record<CompressionLevel, LevelConfig> = {
  screen: { scale: 1.3, quality: 0.5, maxDim: 1000, imgQuality: 0.5, rasterizeAll: true }, // EXTREMA: todo a imagen
  ebook: { scale: 1.5, quality: 0.72, maxDim: 1500, imgQuality: 0.62, rasterizeAll: false }, // equilibrio, conserva texto
  printer: { scale: 2.0, quality: 0.85, maxDim: 2200, imgQuality: 0.82, rasterizeAll: false }, // alta calidad, conserva texto
};

/** Resultado de la compresión con estadísticas para una UI honesta. */
export interface CompressStats {
  pages: number;
  /** Páginas escaneadas/imagen recomprimidas a JPEG. */
  rasterized: number;
  /** Páginas de texto/vector conservadas intactas (el texto sigue seleccionable). */
  kept: number;
  /** Imágenes embebidas recomprimidas/downsampleadas (en páginas con texto incluidas). */
  imagesOptimized: number;
  originalSize: number;
  outputSize: number;
}
export interface CompressResult {
  bytes: Uint8Array;
  stats: CompressStats;
}

// Operadores de pdf.js que pintan imágenes (para distinguir un escaneado de texto/vector).
const IMAGE_OPS = new Set<number>(
  [OPS.paintImageXObject, OPS.paintImageMaskXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat].filter(
    (v): v is number => typeof v === 'number',
  ),
);

// Por debajo de este nº de caracteres "útiles" consideramos que la página no tiene texto real.
const TEXT_THRESHOLD = 10;

/**
 * Decide si una página debe rasterizarse: solo si NO tiene texto real (escaneado o
 * imagen a página completa) Y contiene alguna imagen. Las páginas con texto o
 * vectoriales puras se conservan intactas — así no destruimos el texto seleccionable.
 */
async function shouldRasterize(page: PDFPageProxy): Promise<boolean> {
  const content = await page.getTextContent();
  let textChars = 0;
  for (const item of content.items) {
    if ('str' in item) textChars += (item as { str: string }).str.trim().length;
    if (textChars >= TEXT_THRESHOLD) return false; // tiene texto real → conservar
  }
  // Poco/ningún texto: solo rasterizamos si de verdad hay una imagen que comprimir.
  try {
    const ops = await page.getOperatorList();
    for (const fn of ops.fnArray) if (IMAGE_OPS.has(fn)) return true;
  } catch {
    /* sin operator-list: por seguridad, conservar la página */
  }
  return false;
}

/**
 * Comprime un PDF de forma "inteligente": detecta qué páginas son escaneados/imagen
 * y SOLO esas se rasterizan a JPEG (recomprimiendo). Las páginas de texto y las
 * vectoriales se conservan intactas, manteniendo el texto seleccionable. Si la salida
 * no resulta más pequeña, se devuelve el original. 100% en el navegador.
 */
export async function compressPdf(
  bytes: Uint8Array,
  level: CompressionLevel,
  onProgress?: (done: number, total: number) => void,
): Promise<CompressResult> {
  const { scale, quality, maxDim, imgQuality, rasterizeAll } = LEVELS[level];
  const task = createPdfLoadingTask(bytes);
  const pdf = await task.promise;
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const total = pdf.numPages;

  try {
    // 1) Perfilar cada página → decidir cuáles rasterizar. En modo EXTREMA, todas.
    const rasterize: boolean[] = [];
    for (let n = 1; n <= total; n += 1) {
      if (rasterizeAll) { rasterize.push(true); continue; }
      const page = await pdf.getPage(n);
      rasterize.push(await shouldRasterize(page));
      page.cleanup();
    }

    // 2) Copiar de UNA vez las páginas conservadas (deduplica recursos compartidos
    //    como fuentes/imágenes; copiarlas de a una las duplicaría e inflaría el PDF).
    const keptIndices: number[] = [];
    for (let i = 0; i < total; i += 1) if (!rasterize[i]) keptIndices.push(i);
    const copied = keptIndices.length ? await out.copyPages(src, keptIndices) : [];
    const copiedByIndex = new Map<number, (typeof copied)[number]>();
    keptIndices.forEach((idx, k) => copiedByIndex.set(idx, copied[k]!));

    // 3) Reconstruir en orden; rasterizar solo las escaneadas.
    let done = 0;
    for (let n = 1; n <= total; n += 1) {
      const idx = n - 1;
      if (rasterize[idx]) {
        const page = await pdf.getPage(n);
        const baseViewport = page.getViewport({ scale: 1 });
        const canvas = await renderPageToCanvas(page, scale);
        const jpgBytes = await canvasToJpeg(canvas, quality);
        page.cleanup();

        const embedded = await out.embedJpg(jpgBytes);
        const newPage = out.addPage([baseViewport.width, baseViewport.height]);
        newPage.drawImage(embedded, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
      } else {
        out.addPage(copiedByIndex.get(idx)!);
      }
      onProgress?.((done += 1), total);
    }

    // Recomprime/downsamplea las imágenes JPEG embebidas (incl. las de páginas con texto,
    // que el smart-raster no toca). Es la palanca real de tamaño en PDF con fotos/escaneos.
    let imagesOptimized = 0;
    try {
      const imgStats = await optimizeImagesInDoc(out, { maxDim, quality: imgQuality });
      imagesOptimized = imgStats.optimized;
    } catch { /* sin optimización de imágenes: seguimos con lo que haya */ }

    out.setProducer('DocLab');
    const saved = await out.save({ useObjectStreams: true });
    // Si no logramos reducir (PDF ya optimizado/de texto), devolvemos el original.
    const finalBytes = saved.length < bytes.length ? saved : bytes;
    return {
      bytes: finalBytes,
      stats: {
        pages: total,
        rasterized: rasterize.filter(Boolean).length,
        kept: keptIndices.length,
        imagesOptimized,
        originalSize: bytes.length,
        outputSize: finalBytes.length,
      },
    };
  } finally {
    await task.destroy();
  }
}
