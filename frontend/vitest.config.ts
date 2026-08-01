import { defineConfig } from 'vitest/config';

// Tests de FUNCIONES PURAS (lógica de PDF/estructura/OOXML). Entorno Node, sin
// navegador ni plugins de Vite: no dependen de pdf.js/canvas.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
