import { TOOLS, type Tool } from './tools';

export interface AiSearchResult {
  answer: string;
  tools: Tool[];
}

const byId = new Map(TOOLS.map((tool) => [tool.id, tool]));

/** ¿Está disponible el buscador IA? (lo indica el backend en /api/health). */
export async function isAiSearchAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    const data = (await res.json()) as { ai?: boolean };
    return Boolean(data.ai);
  } catch {
    return false;
  }
}

/**
 * Pregunta a la IA (Gemini, vía backend) qué herramientas encajan con una consulta
 * en lenguaje natural. Solo viaja el texto + el catálogo público, nunca archivos.
 */
export async function aiSearch(query: string): Promise<AiSearchResult> {
  const payload = {
    query,
    tools: TOOLS.map((tool) => ({ id: tool.id, name: tool.name, description: tool.description })),
  };

  const res = await fetch('/api/assistant/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('Demasiadas búsquedas con IA. Inténtalo en un momento.');
    throw new Error('El buscador con IA no está disponible ahora mismo.');
  }

  const data = (await res.json()) as { answer: string; toolIds: string[] };
  const tools = data.toolIds
    .map((id) => byId.get(id))
    .filter((tool): tool is Tool => Boolean(tool));
  return { answer: data.answer, tools };
}
