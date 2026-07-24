import Fuse from 'fuse.js';
import { TOOLS, type Tool } from './tools';
import { CATEGORIES } from './categories';

// Mapa categoría → etiqueta, para indexar también por el nombre de la categoría.
const CATEGORY_LABEL = new Map(CATEGORIES.map((category) => [category.id, category.label]));

interface IndexedTool {
  tool: Tool;
  name: string;
  short: string;
  categoryLabel: string;
  keywords: string;
}

const dataset: IndexedTool[] = TOOLS.map((tool) => ({
  tool,
  name: tool.name,
  short: tool.short,
  categoryLabel: CATEGORY_LABEL.get(tool.category) ?? '',
  keywords: tool.keywords.join(' '),
}));

// Búsqueda difusa: tolera erratas y encuentra por sinónimos (keywords). 100% local.
const fuse = new Fuse(dataset, {
  includeScore: true,
  threshold: 0.42,
  ignoreLocation: true,
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'keywords', weight: 0.3 },
    { name: 'short', weight: 0.15 },
    { name: 'categoryLabel', weight: 0.05 },
  ],
});

/** Devuelve las herramientas que mejor casan con la consulta (vacío → todas). */
export function searchTools(query: string): Tool[] {
  const trimmed = query.trim();
  if (!trimmed) return [...TOOLS];
  return fuse.search(trimmed).map((result) => result.item.tool);
}
