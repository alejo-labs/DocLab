import { describe, it, expect } from 'vitest';
import { PDFName, PDFArray, PDFContext } from 'pdf-lib';
import { isDct, isFlateOnly } from './optimizeImages';

const arrOf = (...names: string[]): PDFArray => {
  const a = PDFArray.withContext(PDFContext.create());
  for (const n of names) a.push(PDFName.of(n));
  return a;
};

describe('isDct', () => {
  it('reconoce JPEG por nombre o dentro de un array', () => {
    expect(isDct(PDFName.of('DCTDecode'))).toBe(true);
    expect(isDct(arrOf('FlateDecode', 'DCTDecode'))).toBe(true);
  });
  it('no marca Flate ni undefined', () => {
    expect(isDct(PDFName.of('FlateDecode'))).toBe(false);
    expect(isDct(undefined)).toBe(false);
  });
});

describe('isFlateOnly', () => {
  it('solo true cuando el único filtro es FlateDecode', () => {
    expect(isFlateOnly(PDFName.of('FlateDecode'))).toBe(true);
    expect(isFlateOnly(arrOf('FlateDecode'))).toBe(true);
  });
  it('false con filtros combinados o JPEG', () => {
    expect(isFlateOnly(arrOf('FlateDecode', 'DCTDecode'))).toBe(false);
    expect(isFlateOnly(PDFName.of('DCTDecode'))).toBe(false);
  });
});
