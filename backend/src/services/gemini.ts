import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

/** Herramienta del catálogo que el frontend envía como contexto. */
export interface CatalogTool {
  id: string;
  name: string;
  description: string;
}

export interface AssistantResult {
  /** Frase breve de guía para el usuario. */
  answer: string;
  /** Ids de herramientas sugeridas (solo del catálogo recibido), por relevancia. */
  toolIds: string[];
}

/** Error específico cuando la IA no está configurada (sin API key). */
export class AiUnavailableError extends Error {
  constructor() {
    super('El buscador con IA no está configurado.');
    this.name = 'AiUnavailableError';
  }
}

let client: GoogleGenAI | null = null;

export function isAiConfigured(): boolean {
  return Boolean(config.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI {
  if (!config.GEMINI_API_KEY) throw new AiUnavailableError();
  if (!client) client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  return client;
}

const SYSTEM_INSTRUCTION = `Eres el asistente de búsqueda de DocLab, una app de herramientas de PDF.
Dada la consulta del usuario y un catálogo de herramientas (id, nombre, descripción), devuelve las
herramientas más relevantes para lo que quiere hacer.
Reglas estrictas:
- Responde SOLO con JSON válido: {"answer": string, "toolIds": string[]}.
- "toolIds" debe contener únicamente ids EXACTOS del catálogo proporcionado, ordenados de más a menos
  relevante, máximo 4. Si nada encaja, devuelve [].
- "answer" es una frase breve (máx. 140 caracteres) en español que oriente al usuario.
- No inventes herramientas ni ids. No añadas texto fuera del JSON.`;

/**
 * Resuelve la intención de búsqueda con Gemini Flash Lite (rápido y económico).
 * Solo viaja el texto de la consulta + el catálogo público; nunca archivos.
 */
export async function assistantSearch(query: string, tools: CatalogTool[]): Promise<AssistantResult> {
  const ai = getClient();

  const catalog = tools.map((t) => `- ${t.id}: ${t.name} — ${t.description}`).join('\n');
  const prompt = `Catálogo de herramientas:\n${catalog}\n\nConsulta del usuario: "${query}"`;

  const response = await ai.models.generateContent({
    model: config.GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    },
  });

  const raw = response.text ?? '';
  const validIds = new Set(tools.map((t) => t.id));

  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; toolIds?: unknown };
    const answer = typeof parsed.answer === 'string' ? parsed.answer.slice(0, 200) : '';
    const toolIds = Array.isArray(parsed.toolIds)
      ? parsed.toolIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)).slice(0, 4)
      : [];
    return { answer, toolIds };
  } catch {
    // Si el modelo no devolvió JSON parseable, degradamos a respuesta vacía.
    return { answer: '', toolIds: [] };
  }
}
