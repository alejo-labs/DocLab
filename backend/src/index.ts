import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  const what = config.SERVE_STATIC ? 'DocLab (web + API)' : 'DocLab API';
  console.log(`🚀 ${what} escuchando en http://localhost:${config.PORT}`);
  console.log(`🔒 Orígenes CORS permitidos: ${config.CORS_ORIGINS.join(', ')}`);
  console.log(`🤖 Buscador con IA: ${config.GEMINI_API_KEY ? 'activo' : 'desactivado (sin GEMINI_API_KEY)'}`);
});

// Timeout de petición para liberar conexiones colgadas.
server.requestTimeout = config.REQUEST_TIMEOUT_MS;
server.headersTimeout = config.REQUEST_TIMEOUT_MS + 5_000;

// Apagado limpio.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} recibido, cerrando servidor...`);
    server.close(() => process.exit(0));
  });
}
