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
      script: path.join(ROOT, 'backend', 'dist', 'index.js'),
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        SERVE_STATIC: 'true',
        STATIC_DIR: path.join(ROOT, 'frontend', 'dist'),
      },
      autorestart: true,
      max_restarts: 10,
      time: true,
    },
  ],
};
