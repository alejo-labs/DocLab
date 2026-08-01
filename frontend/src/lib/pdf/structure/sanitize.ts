/**
 * Elimina los caracteres ILEGALES en XML 1.0 (controles que rompen los .docx/.xlsx/.pptx).
 * Permitidos: \t \n \r y el rango 0x20-0xD7FF, 0xE000-0xFFFD. El texto extraido de un PDF
 * puede traer caracteres de control que, sin sanear, corrompen el documento generado.
 */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function sanitizeXml(s: string): string {
  return s.replace(ILLEGAL, '');
}
