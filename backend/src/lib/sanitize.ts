import path from 'node:path';

// Allowlist: solo conservamos caracteres seguros para nombres de archivo y para
// la cabecera Content-Disposition. Cualquier otra cosa (caracteres de control
// como CR/LF — anti header-injection, comillas, separadores de ruta, unicode no
// imprimible) se reemplaza por "_". Enfoque de lista blanca = más seguro que
// intentar enumerar todo lo peligroso.
const SAFE_FILENAME = /[^A-Za-z0-9._() -]/g;
const COLLAPSE_UNDERSCORES = /_{2,}/g;

/**
 * Sanea un nombre de archivo para usarlo de forma segura en cabeceras HTTP
 * (Content-Disposition) y evitar inyección de cabecera / path traversal.
 */
export function sanitizeFilename(input: string, fallback = 'document'): string {
  // Quitar cualquier parte de directorio (../, /, \).
  const base = path.basename(input ?? '');

  const cleaned = base
    .replace(SAFE_FILENAME, '_')
    .replace(COLLAPSE_UNDERSCORES, '_')
    .replace(/^[._]+/, '')
    .trim();

  const safe = cleaned.length > 0 ? cleaned : fallback;
  return safe.slice(0, 200);
}

/** Devuelve el nombre base sin extensión, ya saneado. */
export function basenameWithoutExt(input: string, fallback = 'document'): string {
  const safe = sanitizeFilename(input, fallback);
  const ext = path.extname(safe);
  const name = ext ? safe.slice(0, -ext.length) : safe;
  return name.length > 0 ? name : fallback;
}
