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

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Formatea un tamaño en bytes de forma legible. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
}
