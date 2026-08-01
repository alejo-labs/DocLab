import type { ErrorRequestHandler, RequestHandler } from 'express';

/** 404 para rutas no existentes. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
};

/**
 * Manejador de errores central. NUNCA filtra stack traces ni mensajes internos
 * al cliente en producción (evita fuga de información).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof Error && err.message.includes('CORS')) {
    res.status(403).json({ error: 'Origen no permitido.' });
    return;
  }

  // Log interno (solo servidor), respuesta genérica al cliente.
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
};
