/** Lee un File como Uint8Array. */
export async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Comprueba que los bytes empiezan por la firma de un PDF ("%PDF-"). Validación
 * por magic bytes en cliente: no se confía en la extensión ni en el tipo MIME.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  );
}

/** Firmas de imagen soportadas para "Imágenes a PDF". */
export function detectImageType(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

/** Codifica bytes a base64 por trozos (seguro para imágenes grandes, no desborda la pila). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Decodifica base64 a bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Bytes de un `data:` URL en base64, SIN usar `fetch` (que la CSP `connect-src 'self'`
 * bloquea para `data:`). Decodifica el base64 directamente.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  return base64ToBytes(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
}

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Formatea un tamaño en bytes de forma legible. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
}
