import express, { type Express } from 'express';
import { corsMiddleware, rateLimiter, securityHeaders } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { assistantRouter } from './routes/assistant.js';

/** Construye la app Express con todo el middleware de seguridad aplicado. */
export function createApp(): Express {
  const app = express();

  // No revelar el framework subyacente.
  app.disable('x-powered-by');
  // Confiar en el proxy de Cloudflare para IP real (rate-limit correcto).
  app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(rateLimiter);
  // Solo se reciben cuerpos JSON pequeños (búsqueda IA); ningún archivo del usuario.
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', healthRouter);
  app.use('/api', assistantRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
