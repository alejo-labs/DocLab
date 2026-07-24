import { OPS } from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { ImageModel, Segment } from './model';
import { minOf, maxOf } from './util';

type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Composición A∘B (aplica B y luego A) en matrices afines [a,b,c,d,e,f]. */
function matMul(A: Mat, B: Mat): Mat {
  return [
    A[0] * B[0] + A[2] * B[1],
    A[1] * B[0] + A[3] * B[1],
    A[0] * B[2] + A[2] * B[3],
    A[1] * B[2] + A[3] * B[3],
    A[0] * B[4] + A[2] * B[5] + A[4],
    A[1] * B[4] + A[3] * B[5] + A[5],
  ];
}
function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function getImageObj(page: PDFPageProxy, id: string): Promise<{ width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray } | null> {
  return Promise.race([
    new Promise<never | null>((res) => {
      try {
        (page as unknown as { objs: { get(id: string, cb: (o: unknown) => void): void } }).objs.get(id, (o) => res((o as never) ?? null));
      } catch { res(null); }
    }),
    new Promise<null>((res) => setTimeout(() => res(null), 4000)),
  ]);
}

async function imgToPng(obj: { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray }): Promise<Uint8Array | null> {
  const { width: w, height: h } = obj;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (obj.bitmap) ctx.drawImage(obj.bitmap, 0, 0);
  else if (obj.data && obj.data.length === w * h * 4) ctx.putImageData(new ImageData(new Uint8ClampedArray(obj.data), w, h), 0, 0);
  else return null;
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

// Nº de coordenadas que consume cada subop de constructPath.
const COORDS: Record<number, number> = {
  [OPS.moveTo]: 2,
  [OPS.lineTo]: 2,
  [OPS.curveTo]: 6,
  [OPS.curveTo2]: 4,
  [OPS.curveTo3]: 4,
  [OPS.closePath]: 0,
  [OPS.rectangle]: 4,
};

/**
 * Extrae imágenes (con posición) y segmentos de línea (para tablas) de una página
 * vía operator-list. Coords top-left. Defensivo: cualquier fallo → vacío.
 */
export async function pageGraphics(page: PDFPageProxy, pageHeight: number): Promise<{ images: ImageModel[]; segments: Segment[] }> {
  const opList = await page.getOperatorList();
  const fns = opList.fnArray;
  const argsArr = opList.argsArray;
  const images: ImageModel[] = [];
  const segments: Segment[] = [];
  let ctm: Mat = IDENTITY;
  const stack: Mat[] = [];
  const toTop = (y: number) => pageHeight - y;

  const pending: Array<{ id: string; m: Mat }> = [];

  for (let i = 0; i < fns.length; i += 1) {
    const fn = fns[i];
    const args = argsArr[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
    else if (fn === OPS.transform) ctm = matMul(ctm, args as unknown as Mat);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintImageMaskXObject) {
      pending.push({ id: String(args[0]), m: ctm });
    } else if (fn === OPS.constructPath) {
      try {
        const pathOps = args[0] as number[];
        const coords = args[1] as number[];
        let ci = 0;
        let cx = 0;
        let cy = 0;
        for (const op of pathOps) {
          const n = COORDS[op] ?? 0;
          if (op === OPS.moveTo) { [cx, cy] = [coords[ci]!, coords[ci + 1]!]; }
          else if (op === OPS.lineTo) {
            const [nx, ny] = [coords[ci]!, coords[ci + 1]!];
            const [ax, ay] = apply(ctm, cx, cy);
            const [bx, by] = apply(ctm, nx, ny);
            segments.push({ x1: ax, y1: toTop(ay), x2: bx, y2: toTop(by) });
            [cx, cy] = [nx, ny];
          } else if (op === OPS.rectangle) {
            const [rx, ry, rw, rh] = [coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!];
            const corners = [apply(ctm, rx, ry), apply(ctm, rx + rw, ry), apply(ctm, rx + rw, ry + rh), apply(ctm, rx, ry + rh)];
            for (let k = 0; k < 4; k += 1) {
              const a = corners[k]!;
              const b = corners[(k + 1) % 4]!;
              segments.push({ x1: a[0], y1: toTop(a[1]), x2: b[0], y2: toTop(b[1]) });
            }
          }
          ci += n;
        }
      } catch { /* path raro: ignorar */ }
    }
  }

  // Resuelve las imágenes pendientes.
  for (const p of pending) {
    try {
      const obj = await getImageObj(page, p.id);
      if (!obj) continue;
      const png = await imgToPng(obj);
      if (!png) continue;
      const corners = [apply(p.m, 0, 0), apply(p.m, 1, 0), apply(p.m, 1, 1), apply(p.m, 0, 1)];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => toTop(c[1]));
      const x = minOf(xs);
      const y = minOf(ys);
      images.push({ bytes: png, mime: 'image/png', x, y, w: maxOf(xs) - x, h: maxOf(ys) - y });
    } catch { /* imagen no disponible: ignorar */ }
  }

  return { images, segments };
}
