import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { corsMiddleware, rateLimiter, securityHeaders, spaSecurityHeaders, permissionsPolicy } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRouter } from './routes/health.js';
import { assistantRouter } from './routes/assistant.js';
import { config } from './config.js';

/** Construye la app Express con todo el middleware de seguridad aplicado. */
export function createApp(): Express {
  const app = express();

  // No revelar el framework subyacente.
  app.disable('x-powered-by');
  // Confiar en el proxy de Cloudflare para IP real (rate-limit correcto).
  app.set('trust proxy', 1);

  // En modo nativo el backend sirve también la SPA, así que necesita la CSP del
  // frontend; en modo API pura (Docker + nginx) basta una CSP muy restrictiva.
  if (config.SERVE_STATIC) {
    app.use(spaSecurityHeaders);
    app.use(permissionsPolicy);
  } else {
    app.use(securityHeaders);
  }
  app.use(corsMiddleware);
  // Solo se reciben cuerpos JSON pequeños (búsqueda IA); ningún archivo del usuario.
  app.use(express.json({ limit: '64kb' }));

  // El rate-limit se aplica SOLO a la API: servir estáticos no debe gastar el cupo.
  app.use('/api', rateLimiter);
  app.use('/api', healthRouter);
  app.use('/api', assistantRouter);

  if (config.SERVE_STATIC) {
    const staticDir = config.STATIC_DIR ?? fileURLToPath(new URL('../../frontend/dist', import.meta.url));
    // Activos con hash: caché larga e inmutable.
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
    // Resto de estáticos (favicon, iconos, tesseract, robots, sitemap…). index.html NO
    // se cachea aquí: lo sirve el fallback con no-cache para recoger cada nuevo build.
    app.use(express.static(staticDir, { maxAge: '1h', index: false }));
    // Fallback de SPA: cualquier GET que no sea de la API devuelve index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
