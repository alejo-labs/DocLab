import { describe, expect, it } from 'vitest';
import { basenameWithoutExt, sanitizeFilename } from './sanitize.js';

describe('sanitizeFilename', () => {
  it('conserva nombres simples válidos', () => {
    expect(sanitizeFilename('informe.docx')).toBe('informe.docx');
  });

  it('elimina componentes de ruta (path traversal)', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('/var/secret.txt')).toBe('secret.txt');
  });

  it('neutraliza intentos de inyección de cabecera (CR/LF)', () => {
    const malicious = 'a.pdf\r\nSet-Cookie: evil=1';
    const result = sanitizeFilename(malicious);
    expect(result).not.toContain('\r');
    expect(result).not.toContain('\n');
  });

  it('reemplaza comillas y caracteres peligrosos', () => {
    expect(sanitizeFilename('na"me<>.pdf')).not.toMatch(/["<>]/);
  });

  it('usa el fallback con entrada vacía o solo inválida', () => {
    expect(sanitizeFilename('')).toBe('document');
    expect(sanitizeFilename('///')).toBe('document');
  });
});

describe('basenameWithoutExt', () => {
  it('quita la extensión', () => {
    expect(basenameWithoutExt('hoja.xlsx')).toBe('hoja');
  });

  it('sanea y quita extensión a la vez', () => {
    expect(basenameWithoutExt('../reporte final.pptx')).toBe('reporte final');
  });
});
