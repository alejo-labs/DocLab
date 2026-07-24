import type { CorsOptions } from 'cors';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { config } from '../config.js';

/**
 * Cabeceras de seguridad. La API solo devuelve archivos/JSON, nunca HTML, así que
 * podemos aplicar una CSP muy restrictiva. El frontend (SPA) sirve su propia CSP.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
});

/** CORS restringido a la allowlist de orígenes (config por env). */
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Permitir peticiones sin Origin (curl, health checks del mismo host).
    if (!origin) {
      callback(null, true);
      return;
    }
    if (config.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por la política CORS'));
  },
  methods: ['GET', 'POST'],
  maxAge: 600,
};

export const corsMiddleware: RequestHandler = cors(corsOptions);

/** Rate limiting global para mitigar abuso/DoS desde un origen público. */
export const rateLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
});

/** Límite más estricto para endpoints de conversión (más costosos). */
export const conversionRateLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: Math.max(10, Math.floor(config.RATE_LIMIT_MAX / 5)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de conversiones alcanzado. Inténtalo de nuevo más tarde.' },
});

/** Límite estricto para el buscador IA (cada consulta cuesta dinero). */
export const assistantRateLimiter: RequestHandler = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has hecho demasiadas búsquedas con IA. Inténtalo de nuevo más tarde.' },
});
