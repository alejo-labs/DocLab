import { Router } from 'express';
import { z } from 'zod';
import { assistantRateLimiter } from '../middleware/security.js';
import { assistantSearch, isAiConfigured, AiUnavailableError } from '../services/gemini.js';

export const assistantRouter: Router = Router();

// Validación estricta: limita longitudes y tamaño del catálogo (anti-abuso).
const searchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  tools: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        name: z.string().min(1).max(80),
        description: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Buscador IA: traduce lenguaje natural a herramientas sugeridas. SOLO viaja el
 * texto de la consulta y el catálogo público; nunca archivos del usuario.
 */
assistantRouter.post('/assistant/search', assistantRateLimiter, async (req, res, next) => {
  if (!isAiConfigured()) {
    res.status(503).json({ error: 'El buscador con IA no está disponible.', fallback: true });
    return;
  }

  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Consulta inválida.' });
    return;
  }

  try {
    const result = await assistantSearch(parsed.data.query, parsed.data.tools);
    res.json(result);
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      res.status(503).json({ error: 'El buscador con IA no está disponible.', fallback: true });
      return;
    }
    next(err);
  }
});
