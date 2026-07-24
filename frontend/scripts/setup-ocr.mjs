/**
 * Prepara los assets del OCR (tesseract.js) en `public/tesseract/` — NO se versionan
 * (son ~9 MB); se generan tras `npm install`. Copia el worker y el core WASM desde
 * node_modules y descarga los modelos de idioma (español + inglés, tessdata_fast).
 * Resiliente: si algo falla (p. ej. sin red), avisa pero NO rompe la instalación.
 */
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'tesseract');
const langDir = join(dest, 'lang');

const COPIES = [
  'tesseract.js/dist/worker.min.js',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm',
  'tesseract.js-core/tesseract-core-simd-lstm.js',
  'tesseract.js-core/tesseract-core-lstm.wasm',
  'tesseract.js-core/tesseract-core-lstm.js',
];
const LANGS = ['eng', 'spa'];
const TESSDATA = 'https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast';

async function main() {
  mkdirSync(langDir, { recursive: true });

  for (const rel of COPIES) {
    const src = join(root, 'node_modules', rel);
    if (!existsSync(src)) {
      console.warn(`⚠️  OCR: falta ${rel} (¿npm install?). El OCR no funcionará hasta que exista.`);
      return;
    }
    copyFileSync(src, join(dest, rel.split('/').pop()));
  }
  console.log('✓ OCR: worker + core copiados');

  for (const lang of LANGS) {
    const out = join(langDir, `${lang}.traineddata.gz`);
    if (existsSync(out)) continue;
    try {
      const res = await fetch(`${TESSDATA}/${lang}.traineddata.gz`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      console.log(`✓ OCR: modelo ${lang} descargado`);
    } catch (e) {
      console.warn(`⚠️  OCR: no se pudo descargar el modelo ${lang} (${e.message}). Ejecuta 'npm run setup:ocr' con red.`);
    }
  }
}

main().catch((e) => console.warn('⚠️  OCR setup:', e.message));
