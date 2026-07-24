import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`🚀 DocLab API escuchando en http://localhost:${config.PORT}`);
  console.log(`🔒 Orígenes CORS permitidos: ${config.CORS_ORIGINS.join(', ')}`);
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
