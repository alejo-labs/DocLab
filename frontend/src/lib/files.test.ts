import { describe, it, expect } from 'vitest';
import { bytesToBase64, base64ToBytes, dataUrlToBytes, pngSize } from './files';

describe('base64 helpers', () => {
  it('round-trip bytes → base64 → bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 128, 255, 65, 66]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
  it('no desborda la pila con arrays grandes (bug del spread)', () => {
    const big = new Uint8Array(300_000).map((_, i) => i % 256);
    expect(() => bytesToBase64(big)).not.toThrow();
  });
  it('dataUrlToBytes decodifica el base64 tras la coma (sin fetch)', () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const url = `data:image/png;base64,${bytesToBase64(bytes)}`;
    expect([...dataUrlToBytes(url)]).toEqual([...bytes]);
  });
});

describe('pngSize', () => {
  it('lee ancho/alto de la cabecera IHDR', () => {
    // Firma PNG + IHDR(len=13, "IHDR") + width=32 + height=16.
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x10,
    ]);
    expect(pngSize(png)).toEqual({ width: 32, height: 16 });
  });
  it('devuelve null si no es PNG', () => {
    expect(pngSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(pngSize(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
