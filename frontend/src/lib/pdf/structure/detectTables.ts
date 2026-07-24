import type { Span, Segment, TableModel, Rect } from './model';

export interface DetectedTable extends Rect {
  table: TableModel;
}

/** Agrupa valores cercanos (≤ tol) y devuelve la media de cada grupo, ordenadas. */
function cluster(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let group: number[] = [];
  for (const v of sorted) {
    if (group.length === 0 || v - group[group.length - 1]! <= tol) group.push(v);
    else { out.push(group.reduce((s, x) => s + x, 0) / group.length); group = [v]; }
  }
  if (group.length) out.push(group.reduce((s, x) => s + x, 0) / group.length);
  return out;
}

interface SegBox { seg: Segment; minX: number; minY: number; maxX: number; maxY: number; horizontal: boolean; vertical: boolean }

function boxOf(seg: Segment): SegBox {
  const minX = Math.min(seg.x1, seg.x2);
  const maxX = Math.max(seg.x1, seg.x2);
  const minY = Math.min(seg.y1, seg.y2);
  const maxY = Math.max(seg.y1, seg.y2);
  const horizontal = maxY - minY < 2 && maxX - minX > 6;
  const vertical = maxX - minX < 2 && maxY - minY > 6;
  return { seg, minX, minY, maxX, maxY, horizontal, vertical };
}

/** Une segmentos cercanos en grupos (componentes conexas) por solape de cajas expandidas. */
function groupSegments(boxes: SegBox[], tol: number): SegBox[][] {
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const near = (a: SegBox, b: SegBox) =>
    a.minX - tol <= b.maxX && b.minX - tol <= a.maxX && a.minY - tol <= b.maxY && b.minY - tol <= a.maxY;
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1)
      if (near(boxes[i]!, boxes[j]!)) parent[find(i)] = find(j);
  const groups = new Map<number, SegBox[]>();
  boxes.forEach((b, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(b);
  });
  return [...groups.values()];
}

/**
 * Detecta tablas con bordes (rejilla de líneas) y reconstruye sus celdas con los spans.
 * Función pura. Devuelve las tablas y las regiones que ocupan (para excluir esos spans
 * del texto normal). Coords top-left.
 */
export function detectTables(segments: Segment[], spans: Span[]): { tables: DetectedTable[]; regions: Rect[] } {
  const boxes = segments.map(boxOf).filter((b) => b.horizontal || b.vertical);
  if (boxes.length < 4) return { tables: [], regions: [] };

  const tables: DetectedTable[] = [];
  const regions: Rect[] = [];

  for (const group of groupSegments(boxes, 8)) {
    const hs = group.filter((b) => b.horizontal);
    const vs = group.filter((b) => b.vertical);
    if (hs.length < 2 || vs.length < 2) continue;

    const colX = cluster(vs.map((b) => (b.minX + b.maxX) / 2), 4);
    const rowY = cluster(hs.map((b) => (b.minY + b.maxY) / 2), 4);
    const cols = colX.length - 1;
    const rows = rowY.length - 1;
    if (cols < 1 || rows < 1 || (cols < 2 && rows < 2)) continue;

    const x0 = colX[0]!;
    const x1 = colX[colX.length - 1]!;
    const y0 = rowY[0]!;
    const y1 = rowY[rowY.length - 1]!;
    const region: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };

    // Spans dentro de la región → a su celda.
    const inside = spans.filter((s) => {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      return cx >= x0 - 2 && cx <= x1 + 2 && cy >= y0 - 2 && cy <= y1 + 2;
    });

    const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
    const cells: Span[][][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => [] as Span[]));
    for (const s of inside) {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      let c = -1;
      let r = -1;
      for (let j = 0; j < cols; j += 1) if (cx >= colX[j]! && cx < colX[j + 1]!) { c = j; break; }
      for (let i = 0; i < rows; i += 1) if (cy >= rowY[i]! && cy < rowY[i + 1]!) { r = i; break; }
      if (c >= 0 && r >= 0) cells[r]![c]!.push(s);
    }
    for (let i = 0; i < rows; i += 1)
      for (let j = 0; j < cols; j += 1)
        grid[i]![j] = cells[i]![j]!.sort((a, b) => (a.y - b.y) || (a.x - b.x)).map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();

    // Ignora tablas vacías (líneas sueltas sin texto dentro).
    if (grid.flat().every((c) => c === '')) continue;

    tables.push({ table: { rows: grid, cols, bordered: true }, ...region });
    regions.push(region);
  }

  return { tables, regions };
}
