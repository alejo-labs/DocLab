import * as dotenv from 'dotenv';
import { z } from 'zod';

// En test no cargamos el .env del desarrollador: los tests deben ser herméticos
// (no depender de claves locales como GEMINI_API_KEY).
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

/**
 * Configuración central validada con zod. Si una variable es inválida el proceso
 * falla al arrancar (fail-fast) en lugar de comportarse de forma insegura.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Lista de orígenes permitidos para CORS, separados por coma.
  // Ej: "https://pdf.midominio.com,http://localhost:5174"
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5174')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Rate limiting.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Timeout de petición en ms (conversiones de Office pueden tardar).
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  // Buscador IA con Google Gemini (opcional). Sin clave, el endpoint
  // /api/assistant/search responde 503 y el frontend cae a la búsqueda local.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'),

  // Servir el frontend ya compilado desde el propio backend (despliegue nativo/PM2,
  // sin nginx). En el stack Docker esto lo hace nginx, así que se deja en false.
  SERVE_STATIC: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1' || v === 'on'),
  // Ruta al build del frontend. Por defecto se resuelve junto al backend (../frontend/dist).
  STATIC_DIR: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // No filtramos valores, solo qué claves fallaron.
  console.error('❌ Configuración de entorno inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
} as const;
