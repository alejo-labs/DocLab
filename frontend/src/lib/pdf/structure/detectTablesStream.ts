import type { Span, Rect, TableModel } from './model';
import { minBy, maxBy } from './util';

export interface StreamTable extends Rect { table: TableModel }

interface Cell { x: number; right: number; text: string }
interface Row { y: number; h: number; cells: Cell[] }

function avg(a: number[]): number { return a.reduce((s, v) => s + v, 0) / (a.length || 1); }

/** Agrupa spans en filas (por Y) y, dentro de cada fila, en celdas (por huecos en X). */
function groupRows(spans: Span[]): Row[] {
  const valid = spans.filter((s) => s.text.trim().length > 0);
  const sorted = [...valid].sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
  const groups: Span[][] = [];
  for (const s of sorted) {
    const last = groups[groups.length - 1];
    if (last) {
      const ly = avg(last.map((t) => t.y + t.h / 2));
      const tol = Math.min(s.h, last[0]!.h) * 0.6;
      if (Math.abs((s.y + s.h / 2) - ly) <= tol) { last.push(s); continue; }
    }
    groups.push([s]);
  }
  return groups.map((g): Row => {
    const ws = [...g].sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    for (const w of ws) {
      const last = cells[cells.length - 1];
      const gap = last ? w.x - last.right : Infinity;
      if (last && gap < Math.max(8, w.fontSize * 0.6)) {
        last.text += (/\s$/.test(last.text) ? '' : ' ') + w.text;
        last.right = w.x + w.w;
      } else {
        cells.push({ x: w.x, right: w.x + w.w, text: w.text.trim() });
      }
    }
    const y = minBy(g, (s) => s.y);
    const h = maxBy(g, (s) => s.y + s.h) - y;
    return { y, h, cells };
  }).sort((a, b) => a.y - b.y);
}

function cluster(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let group: number[] = [];
  for (const v of sorted) {
    if (group.length === 0 || v - group[group.length - 1]! <= tol) group.push(v);
    else { out.push(avg(group)); group = [v]; }
  }
  if (group.length) out.push(avg(group));
  return out;
}

function buildTable(run: Row[]): StreamTable | null {
  const colLefts = cluster(run.flatMap((r) => r.cells.map((c) => c.x)), 14);
  const cols = colLefts.length;
  if (cols < 2) return null;

  const colTol = 24;
  const grid: string[][] = [];
  let placed = 0;
  let totalCells = 0;
  for (const row of run) {
    const cells = Array.from({ length: cols }, () => '');
    for (const c of row.cells) {
      totalCells += 1;
      let ci = -1;
      let bd = colTol;
      for (let j = 0; j < cols; j += 1) { const d = Math.abs(c.x - colLefts[j]!); if (d < bd) { bd = d; ci = j; } }
      if (ci >= 0) { cells[ci] = cells[ci] ? `${cells[ci]} ${c.text}` : c.text; placed += 1; }
    }
    grid.push(cells);
  }
  if (placed / Math.max(1, totalCells) < 0.8) return null;

  // Al menos 2 columnas con ≥2 celdas no vacías (rejilla real, no una lista).
  const filledPerCol = Array.from({ length: cols }, (_, j) => grid.filter((r) => r[j]!.trim()).length);
  if (filledPerCol.filter((n) => n >= 2).length < 2) return null;

  // Guarda anti-LISTA: si una columna es mayoritariamente marcadores de viñeta
  // (• · ▪ – — *), es una lista con viñetas, no una tabla.
  const BULLET = /^[•·▪◦‣*–—-]$/;
  for (let j = 0; j < cols; j += 1) {
    const filled = grid.filter((r) => r[j]!.trim()).length;
    const bullets = grid.filter((r) => BULLET.test(r[j]!.trim())).length;
    if (filled >= 2 && bullets >= filled * 0.6) return null;
  }

  // Guarda anti-falso-positivo: 2 columnas de TEXTO largo = página a 2 columnas, no tabla.
  if (cols === 2) {
    const longCells = grid.flat().filter((c) => c.length > 30).length;
    if (longCells > grid.length) return null;
  }

  // Poda de columnas vacías (artefactos de celdas dispersas) → tabla más limpia.
  const keep = Array.from({ length: cols }, (_, j) => grid.some((r) => r[j]!.trim().length > 0));
  const keptLefts = colLefts.filter((_, j) => keep[j]);
  const prunedCols = keptLefts.length;
  if (prunedCols < 2) return null;
  const prunedGrid = grid.map((r) => r.filter((_, j) => keep[j]));

  // Bloque pequeño y muy disperso (p. ej. metadatos label:value) → no es una tabla real.
  const nonEmpty = prunedGrid.flat().filter((c) => c.trim().length > 0).length;
  if (prunedGrid.length <= 3 && nonEmpty / (prunedGrid.length * prunedCols) < 0.4) return null;

  const allCells = run.flatMap((r) => r.cells);
  const x = minBy(allCells, (c) => c.x);
  const right = maxBy(allCells, (c) => c.right);
  const y = minBy(run, (r) => r.y);
  const bottom = maxBy(run, (r) => r.y + r.h);
  const colWidths = keptLefts.map((lx, j) => (j < prunedCols - 1 ? keptLefts[j + 1]! : right) - lx);

  return { x, y, w: right - x, h: bottom - y, table: { rows: prunedGrid, cols: prunedCols, colWidths, bordered: false } };
}

/**
 * Detecta tablas SIN bordes por análisis de espaciado (método "stream"). Función pura.
 * Devuelve las tablas y sus regiones (para excluir esos spans del texto normal).
 */
export function detectTablesStream(spans: Span[]): { tables: StreamTable[]; regions: Rect[] } {
  const rows = groupRows(spans);
  const tables: StreamTable[] = [];
  const regions: Rect[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i]!.cells.length < 2) { i += 1; continue; }
    let j = i;
    while (j + 1 < rows.length && rows[j + 1]!.cells.length >= 2) {
      const gap = rows[j + 1]!.y - (rows[j]!.y + rows[j]!.h);
      if (gap > Math.max((rows[j]!.h || 12) * 1.8, 14)) break;
      // Cortar si el nº de celdas cambia mucho → son bloques estructuralmente distintos
      // (p. ej. los metadatos de una factura vs. sus líneas). Evita tablas de 12 columnas.
      const a = rows[j]!.cells.length;
      const b = rows[j + 1]!.cells.length;
      if (Math.max(a, b) / Math.min(a, b) > 2.5) break;
      j += 1;
    }
    const run = rows.slice(i, j + 1);
    if (run.length >= 2) {
      const t = buildTable(run);
      if (t) { tables.push(t); regions.push({ x: t.x, y: t.y, w: t.w, h: t.h }); }
    }
    i = j + 1;
  }
  return { tables, regions };
}
