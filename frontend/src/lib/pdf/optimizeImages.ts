import { PDFDocument, PDFName, PDFRawStream, PDFArray, PDFNumber, PDFContext, PDFRef, type PDFDict, type PDFObject } from 'pdf-lib';
import { inflateSync } from 'fflate';

const N = (s: string) => PDFName.of(s);
const numOf = (o: PDFObject | undefined, d: number): number => (o instanceof PDFNumber ? o.asNumber() : d);

export interface ImageOptOptions { maxDim: number; quality: number }
export interface ImageOptStats { images: number; optimized: number; before: number; after: number }

/** Resultado de recodificar una imagen: bytes JPEG + dimensiones nuevas. */
export interface Encoded { bytes: Uint8Array; w: number; h: number }
export type ImageEncoder = (raw: Uint8Array, maxDim: number, quality: number) => Promise<Encoded | null>;

/** ¿El filtro del stream es DCTDecode (JPEG)? Acepta nombre o array de filtros. */
export function isDct(filter: unknown): boolean {
  if (filter instanceof PDFName) return filter === N('DCTDecode');
  if (filter instanceof PDFArray) {
    for (let i = 0; i < filter.size(); i += 1) if (filter.get(i) === N('DCTDecode')) return true;
  }
  return false;
}

/** ¿El filtro es SOLO FlateDecode (imagen "PNG")? */
export function isFlateOnly(filter: unknown): boolean {
  if (filter instanceof PDFName) return filter === N('FlateDecode');
  if (filter instanceof PDFArray) return filter.size() === 1 && filter.get(0) === N('FlateDecode');
  return false;
}

/** Nº de componentes de color (1=gris, 3=RGB) o null si no soportado (CMYK/indexed). */
export function colorComponents(cs: PDFObject | undefined, ctx: PDFContext): number | null {
  let c = cs;
  if (c instanceof PDFRef) c = ctx.lookup(c) ?? c; // resolver referencia indirecta
  if (c instanceof PDFName) {
    const n = c.toString();
    if (n === '/DeviceRGB' || n === '/CalRGB' || n === '/RGB') return 3;
    if (n === '/DeviceGray' || n === '/CalGray' || n === '/G') return 1;
    return null;
  }
  if (c instanceof PDFArray && c.size() > 0) {
    const head = c.get(0).toString();
    if (head === '/ICCBased') { const s = ctx.lookup(c.get(1)); return s instanceof PDFRawStream ? numOf(s.dict.get(N('N')), 0) || null : null; }
    if (head === '/CalRGB') return 3;
    if (head === '/CalGray') return 1;
    return null; // Indexed/Separation/DeviceN: no soportado en v1
  }
  return null;
}

/** Aplica el predictor (PNG 10-15 o TIFF 2) a los datos inflados. */
function unpredict(data: Uint8Array, predictor: number, colors: number, columns: number): Uint8Array {
  if (predictor < 2) return data;
  const bpp = colors; // 8 bits/componente
  const rowLen = columns * colors;
  if (predictor === 2) { // TIFF horizontal
    for (let r = 0; r * rowLen < data.length; r += 1) {
      const o = r * rowLen;
      for (let x = bpp; x < rowLen; x += 1) data[o + x] = (data[o + x] + data[o + x - bpp]) & 0xff;
    }
    return data;
  }
  // PNG: cada fila lleva 1 byte de tipo de filtro al inicio.
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let r = 0; r < rows; r += 1) {
    const ft = data[r * (rowLen + 1)]!;
    const inOff = r * (rowLen + 1) + 1;
    const outOff = r * rowLen;
    for (let x = 0; x < rowLen; x += 1) {
      const raw = data[inOff + x]!;
      const a = x >= bpp ? out[outOff + x - bpp]! : 0;
      const b = r > 0 ? out[outOff - rowLen + x]! : 0;
      const cc = r > 0 && x >= bpp ? out[outOff - rowLen + x - bpp]! : 0;
      let v = raw;
      if (ft === 1) v = raw + a;
      else if (ft === 2) v = raw + b;
      else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) { const p = a + b - cc; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - cc); v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc); }
      out[outOff + x] = v & 0xff;
    }
  }
  return out;
}

/** Decodifica una imagen FlateDecode (RGB/gris 8-bit) a RGBA. Pura (fflate). null si no soportada. */
export function decodeFlateImage(raw: Uint8Array, dict: PDFDict, ctx: PDFContext): DecodedImage | null {
  try {
    const w = numOf(dict.get(N('Width')), 0);
    const h = numOf(dict.get(N('Height')), 0);
    const bpc = numOf(dict.get(N('BitsPerComponent')), 8);
    if (!w || !h || bpc !== 8) return null;
    const comps = colorComponents(dict.get(N('ColorSpace')), ctx);
    if (comps !== 1 && comps !== 3) return null;
    let dp = ctx.lookup(dict.get(N('DecodeParms')) ?? dict.get(N('DP'))) ?? dict.get(N('DecodeParms'));
    if (dp instanceof PDFArray) dp = ctx.lookup(dp.get(dp.size() - 1));
    const predictor = dp && 'get' in dp ? numOf((dp as PDFDict).get(N('Predictor')), 1) : 1;
    const columns = dp && 'get' in dp ? numOf((dp as PDFDict).get(N('Columns')), w) : w;
    const dpColors = dp && 'get' in dp ? numOf((dp as PDFDict).get(N('Colors')), comps) : comps;
    const inflated = unpredict(inflateSync(raw), predictor, dpColors, columns);
    const rgba = new Uint8ClampedArray(w * h * 4);
    const px = w * h;
    if (comps === 3) {
      for (let i = 0; i < px; i += 1) { const s = i * 3; rgba[i * 4] = inflated[s]!; rgba[i * 4 + 1] = inflated[s + 1]!; rgba[i * 4 + 2] = inflated[s + 2]!; rgba[i * 4 + 3] = 255; }
    } else {
      for (let i = 0; i < px; i += 1) { const g = inflated[i]!; rgba[i * 4] = g; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = g; rgba[i * 4 + 3] = 255; }
    }
    return { rgba, w, h };
  } catch {
    return null;
  }
}

export interface DecodedImage { rgba: Uint8ClampedArray; w: number; h: number }
export type RgbaEncoder = (img: DecodedImage, maxDim: number, quality: number) => Promise<Encoded | null>;

/** RGBA → JPEG (downsample si excede maxDim) con canvas. SOLO navegador. */
export const jpegFromRgba: RgbaEncoder = async (img, maxDim, quality) => {
  try {
    const c1 = document.createElement('canvas');
    c1.width = img.w; c1.height = img.h;
    const x1 = c1.getContext('2d');
    if (!x1) return null;
    const id = x1.createImageData(img.w, img.h);
    id.data.set(img.rgba);
    x1.putImageData(id, 0, 0);
    const scale = Math.min(1, maxDim / Math.max(img.w, img.h));
    const w = Math.max(1, Math.round(img.w * scale));
    const h = Math.max(1, Math.round(img.h * scale));
    let src: HTMLCanvasElement = c1;
    if (scale < 1) { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const x2 = c2.getContext('2d'); if (!x2) return null; x2.drawImage(c1, 0, 0, w, h); src = c2; }
    const blob = await new Promise<Blob | null>((r) => src.toBlob(r, 'image/jpeg', quality));
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } catch {
    return null;
  }
};

/** Recomprime un JPEG con canvas (downsample si excede maxDim). SOLO navegador. */
export const recompressJpeg: ImageEncoder = async (raw, maxDim, quality) => {
  try {
    const bmp = await createImageBitmap(new Blob([raw as BlobPart], { type: 'image/jpeg' }));
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bmp.close?.(); return null; }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!out) return null;
    return { bytes: new Uint8Array(await out.arrayBuffer()), w, h };
  } catch {
    return null;
  }
};

/** Reemplaza el stream de una imagen por una versión recomprimida, conservando el resto del dict. */
export function replaceImageStream(doc: PDFDocument, ref: PDFRef, dict: PDFDict, enc: Encoded): void {
  dict.set(N('Width'), PDFNumber.of(enc.w));
  dict.set(N('Height'), PDFNumber.of(enc.h));
  dict.set(N('BitsPerComponent'), PDFNumber.of(8));
  dict.set(N('ColorSpace'), N('DeviceRGB'));
  dict.set(N('Filter'), N('DCTDecode'));
  dict.delete(N('DecodeParms'));
  dict.delete(N('Decode'));
  doc.context.assign(ref, PDFRawStream.of(dict, enc.bytes));
}

/**
 * Optimiza in situ las imágenes JPEG embebidas de un PDFDocument ya cargado: las
 * downsamplea/recomprime sin tocar el texto ni los vectores. Salta máscaras, CMYK y
 * transparencias (SMask) para no degradar. `encoder` se inyecta en tests (canvas → navegador).
 */
export async function optimizeImagesInDoc(
  doc: PDFDocument,
  opts: ImageOptOptions,
  encoder: ImageEncoder = recompressJpeg,
  rgbaEncoder: RgbaEncoder = jpegFromRgba,
): Promise<ImageOptStats> {
  const stats: ImageOptStats = { images: 0, optimized: 0, before: 0, after: 0 };
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.get(N('Subtype')) !== N('Image')) continue;
    stats.images += 1;
    const raw = obj.contents;
    stats.before += raw.length;
    // Saltamos máscaras/transparencias (no degradar).
    if (dict.get(N('ImageMask')) || dict.get(N('SMask')) || dict.get(N('Mask'))) { stats.after += raw.length; continue; }

    const filter = dict.get(N('Filter'));
    let enc: Encoded | null = null;
    try {
      if (isDct(filter)) {
        enc = await encoder(raw, opts.maxDim, opts.quality); // JPEG → recomprimir
      } else if (isFlateOnly(filter)) {
        const dec = decodeFlateImage(raw, dict, doc.context); // PNG/Flate → decodificar
        if (dec) enc = await rgbaEncoder(dec, opts.maxDim, opts.quality);
      }
    } catch { enc = null; }
    if (!enc || enc.bytes.length >= raw.length) { stats.after += raw.length; continue; }
    replaceImageStream(doc, ref, dict, enc);
    stats.optimized += 1;
    stats.after += enc.bytes.length;
  }
  return stats;
}
