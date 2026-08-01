import type { Page, Block, Line } from './model';

function blockLines(b: Block): Line[] | null {
  if (b.kind === 'heading' || b.kind === 'paragraph') return b.lines;
  if (b.kind === 'list') return b.items;
  return null;
}
function blockText(b: Block): string {
  const ls = blockLines(b);
  return ls ? ls.map((l) => l.text).join(' ') : '';
}
/** Normaliza para comparar entre páginas: minúsculas, dígitos→# (nº de página), espacios colapsados. */
const norm = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

/**
 * Detecta encabezados/pies REPETIDOS: bloques de texto en la banda superior/inferior cuyo
 * texto normalizado aparece en ≥50% de las páginas. Los QUITA de `page.blocks` (mutación) y
 * devuelve unas líneas representativas para el Header/Footer de Word. Pura y testeable en Node.
 */
export function detectHeaderFooter(pages: Page[]): { header?: Line[]; footer?: Line[] } {
  if (pages.length < 3) return {};
  const top = new Map<string, { count: number; lines: Line[] }>();
  const bot = new Map<string, { count: number; lines: Line[] }>();

  for (const page of pages) {
    const topBand = page.height * 0.12;
    const botBand = page.height * 0.88;
    const seenTop = new Set<string>();
    const seenBot = new Set<string>();
    for (const b of page.blocks) {
      const lines = blockLines(b);
      if (!lines) continue;
      const sig = norm(blockText(b));
      if (sig.length < 2) continue;
      if (b.y + b.h <= topBand && !seenTop.has(sig)) {
        seenTop.add(sig);
        const e = top.get(sig) ?? { count: 0, lines };
        e.count += 1;
        top.set(sig, e);
      } else if (b.y >= botBand && !seenBot.has(sig)) {
        seenBot.add(sig);
        const e = bot.get(sig) ?? { count: 0, lines };
        e.count += 1;
        bot.set(sig, e);
      }
    }
  }

  const need = Math.ceil(pages.length * 0.6); // conservador (docs mixtos)
  const headerSigs = new Set([...top].filter(([, e]) => e.count >= need).map(([s]) => s));
  const footerSigs = new Set([...bot].filter(([, e]) => e.count >= need).map(([s]) => s));
  if (headerSigs.size === 0 && footerSigs.size === 0) return {};

  // "Como un humano": el encabezado repetido se conserva SOLO en su primera aparición
  // (suele ser el título) y se elimina del resto de páginas; los pies repetidos
  // (números de página, etc.) se eliminan del todo. NO se usa el Header/Footer de Word.
  const keptHeader = new Set<string>();
  for (const page of pages) {
    const topBand = page.height * 0.12;
    const botBand = page.height * 0.88;
    page.blocks = page.blocks.filter((b) => {
      const lines = blockLines(b);
      if (!lines) return true;
      const sig = norm(blockText(b));
      if (sig.length < 2) return true;
      if (b.y + b.h <= topBand && headerSigs.has(sig)) {
        if (!keptHeader.has(sig)) { keptHeader.add(sig); return true; } // conserva la 1ª
        return false; // quita las repeticiones
      }
      if (b.y >= botBand && footerSigs.has(sig)) return false; // quita todos los pies repetidos
      return true;
    });
  }
  return {}; // no se exporta nada al Header/Footer de Word
}
