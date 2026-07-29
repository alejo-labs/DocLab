const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Configuración de PM2 para DocLab en despliegue NATIVO (sin Docker), al estilo del ERP.
 * El backend sirve la SPA ya compilada (SERVE_STATIC) y la API en un único puerto.
 *
 * Las variables sensibles (CORS_ORIGINS y GEMINI_API_KEY) se leen de `backend/.env`
 * (por eso `cwd` apunta a backend/). Aquí solo van las no secretas.
 */
module.exports = {
  apps: [
    {
      name: 'doclab',
      cwd: path.join(ROOT, 'backend'),
      // Script RELATIVO al cwd, no absoluto. Si la ruta del proyecto tiene espacios
      // (p. ej. "PDF Proyect"), un script absoluto rompe el arranque en PM2 (lo parte
      // por el espacio). Con cwd + script relativo se ejecuta "node dist/index.js".
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        SERVE_STATIC: 'true',
        // STATIC_DIR se pasa como variable de entorno (Node maneja bien los espacios).
        STATIC_DIR: path.join(ROOT, 'frontend', 'dist'),
      },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
  ],
};
