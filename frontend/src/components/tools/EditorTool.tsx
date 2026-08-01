import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useReportProcessing } from '../../lib/processing';
import interact from 'interactjs';
import {
  MousePointer2, Type, Pencil, Highlighter, Shapes, ImagePlus, Eraser, PenTool,
  Trash2, Save, GripVertical, Undo2, Redo2, Copy, RotateCw, ChevronUp, ChevronDown,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Square, Circle, Minus, ArrowRight, Stamp,
} from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { ColorControl, BrushSlider, LabeledSlider, ToggleIcon, Segmented, ZoomControls } from '../editor-kit/controls';
import { SignatureModal } from '../editor-kit/SignatureModal';
import { SelectionFrame } from '../editor-kit/SelectionFrame';
import { detectImageType, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { usePdfPages, type EditorPage } from '../../lib/pdf/usePdfPages';
import { useShortcuts } from '../../lib/editor/useShortcuts';
import { toast } from '../../lib/notify/toast';
import {
  applyAnnotations, FONTS,
  type Annotation, type FontFamily, type Point, type ShapeKind, type TextAlign, type TextAnnotation, type ShapeAnnotation,
} from '../../lib/pdf/annotations';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import type { ToolEngineProps, ToolResult } from './types';

type Tool = 'select' | 'text' | 'draw' | 'highlight' | 'shape' | 'image' | 'signature' | 'eraser' | 'stamp';

const STAMPS: { label: string; color: string }[] = [
  { label: 'APROBADO', color: '#16a34a' },
  { label: 'RECHAZADO', color: '#dc2626' },
  { label: 'CONFIDENCIAL', color: '#dc2626' },
  { label: 'BORRADOR', color: '#64748b' },
  { label: 'URGENTE', color: '#ea580c' },
  { label: 'REVISADO', color: '#2563eb' },
  { label: 'ORIGINAL', color: '#0f766e' },
  { label: 'PAGADO', color: '#16a34a' },
];

type Draft =
  | { kind: 'draw'; page: number; color: string; width: number; opacity: number; points: Point[] }
  | { kind: 'rect-like'; tool: 'highlight' | 'shape'; shape?: ShapeKind; page: number; x: number; y: number; w: number; h: number };

const uid = () => crypto.randomUUID();

type Sized = import('../../lib/pdf/annotations').ImageAnnotation | import('../../lib/pdf/annotations').HighlightAnnotation | import('../../lib/pdf/annotations').ShapeAnnotation;
/** Elementos con caja (x,y,width,height): imagen, resaltado, forma (NO draw/text). */
function isSized(a: Annotation): a is Sized {
  return a.type === 'image' || a.type === 'highlight' || a.type === 'shape';
}

function drawBBox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Caja (puntos de página) de una anotación, para hit-test del lazo. */
function annBox(a: Annotation): Box {
  if (a.type === 'draw') {
    const b = drawBBox(a.points);
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
  if (a.type === 'text') {
    const w = Math.max(40, Math.max(0, ...a.text.split('\n').map((l) => l.length)) * a.size * 0.5);
    return { x: a.x, y: a.y, w, h: a.text.split('\n').length * a.size * 1.2 };
  }
  return { x: Math.min(a.x, a.x + a.width), y: Math.min(a.y, a.y + a.height), w: Math.abs(a.width), h: Math.abs(a.height) };
}
function rectsIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Posición (px) para anclar la barra flotante encima del elemento seleccionado. */
function selAnchor(sel: Annotation, s: number): { left: number; top: number } {
  if (sel.type === 'draw') {
    const b = drawBBox(sel.points);
    return { left: (b.x + b.w / 2) * s, top: b.y * s };
  }
  if (sel.type === 'text') return { left: sel.x * s + 50, top: sel.y * s };
  const x = Math.min(sel.x, sel.x + sel.width);
  const y = Math.min(sel.y, sel.y + sel.height);
  return { left: (x + Math.abs(sel.width) / 2) * s, top: y * s };
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Imanta la caja a los centros/bordes de la página y de otros elementos. */
function computeSnap(box: Box, others: Box[], pageW: number, pageH: number, thresh: number) {
  const candX = [pageW / 2, ...others.flatMap((o) => [o.x, o.x + o.w, o.x + o.w / 2])];
  const candY = [pageH / 2, ...others.flatMap((o) => [o.y, o.y + o.h, o.y + o.h / 2])];
  const pointsX = [box.x, box.x + box.w, box.x + box.w / 2];
  const pointsY = [box.y, box.y + box.h, box.y + box.h / 2];

  let bestX: { adjust: number; line: number; d: number } | null = null;
  for (const p of pointsX) for (const c of candX) {
    const d = Math.abs(c - p);
    if (d <= thresh && (!bestX || d < bestX.d)) bestX = { adjust: c - p, line: c, d };
  }
  let bestY: { adjust: number; line: number; d: number } | null = null;
  for (const p of pointsY) for (const c of candY) {
    const d = Math.abs(c - p);
    if (d <= thresh && (!bestY || d < bestY.d)) bestY = { adjust: c - p, line: c, d };
  }
  return {
    x: box.x + (bestX?.adjust ?? 0),
    y: box.y + (bestY?.adjust ?? 0),
    vx: bestX?.line ?? null,
    hy: bestY?.line ?? null,
  };
}
export function EditorTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');

  // Estado editable + historial manual (snapshot antes de cada cambio).
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annRef = useRef(annotations);
  annRef.current = annotations;
  const undoStack = useRef<Annotation[][]>([]);
  const redoStack = useRef<Annotation[][]>([]);
  const lastSnap = useRef(0);
  const [, tick] = useState(0);
  const snapshot = useCallback(() => {
    undoStack.current.push(annRef.current);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    tick((t) => t + 1);
  }, []);
  const snapshotMaybe = useCallback(() => {
    const now = Date.now();
    if (now - lastSnap.current > 400) snapshot();
    lastSnap.current = now;
  }, [snapshot]);
  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(annRef.current);
    setAnnotations(undoStack.current.pop()!);
    tick((t) => t + 1);
  }, []);
  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(annRef.current);
    setAnnotations(redoStack.current.pop()!);
    tick((t) => t + 1);
  }, []);

  const [tool, setTool] = useState<Tool>('select');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0]! : null;
  const selectOnly = useCallback((id: string) => setSelectedIds(new Set([id])), []);
  const toggleSel = useCallback((id: string) => setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const clearSel = useCallback(() => setSelectedIds(new Set()), []);
  const onElementClick = useCallback((id: string, shift: boolean) => {
    setTool('select'); // clic en un elemento = enfocarlo y poder editarlo, sin cambiar de herramienta a mano
    if (shift) toggleSel(id);
    else setSelectedIds((p) => (p.has(id) && p.size > 1 ? p : new Set([id])));
  }, [toggleSel]);
  const selRef = useRef<Set<string>>(selectedIds);
  selRef.current = selectedIds;
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState<FontFamily>('helvetica');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [guides, setGuides] = useState<{ page: number; vx: number | null; hy: number | null } | null>(null);
  const [marquee, setMarquee] = useState<{ page: number; x: number; y: number; w: number; h: number } | null>(null);
  const [ghost, setGhost] = useState<{ page: number; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);
  useReportActiveDoc(!!bytes);

  const colRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activePage, setActivePage] = useState(0);
  const { pages, loading, error: loadError } = usePdfPages(bytes, 850);
  const pagesRef = useRef<EditorPage[]>([]);
  pagesRef.current = pages;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const erasingRef = useRef(false);

  const imageUrls = useRef<Map<string, string>>(new Map());
  function imageUrl(id: string, b: Uint8Array): string {
    let u = imageUrls.current.get(id);
    if (!u) {
      u = URL.createObjectURL(new Blob([b.slice().buffer]));
      imageUrls.current.set(id, u);
    }
    return u;
  }
  useEffect(() => {
    const urls = imageUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);


  useEffect(() => {
    const h = takeHandoff();
    if (h) {
      setFileName(stripExtension(h.filename));
      setBytes(h.bytes);
    }
  }, []);

  // Página visible (para el minimap).
  const ratios = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    if (pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => ratios.current.set(Number((e.target as HTMLElement).dataset.pageIdx), e.intersectionRatio));
        let bestIdx = 0;
        let bestRatio = -1;
        ratios.current.forEach((r, i) => {
          if (r > bestRatio) { bestRatio = r; bestIdx = i; }
        });
        setActivePage(bestIdx);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [pages.length]);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;

  // Mutaciones discretas.
  const patch = useCallback((id: string, partial: Partial<Annotation>, withSnapshot = true) => {
    if (withSnapshot) snapshotMaybe();
    setAnnotations((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...partial } as Annotation) : a)));
  }, [snapshotMaybe]);
  const add = useCallback((a: Annotation) => {
    snapshot();
    setAnnotations((prev) => [...prev, a]);
  }, [snapshot]);
  const removeId = useCallback((id: string) => {
    snapshot();
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((p) => { if (!p.has(id)) return p; const n = new Set(p); n.delete(id); return n; });
  }, [snapshot]);
  const removeSelected = useCallback(() => {
    const ids = selRef.current;
    if (!ids.size) return;
    snapshot();
    setAnnotations((prev) => prev.filter((a) => !ids.has(a.id)));
    clearSel();
  }, [snapshot, clearSel]);
  const duplicateSelected = useCallback(() => {
    const ids = selRef.current;
    if (!ids.size) return;
    snapshot();
    const copies = annRef.current.filter((a) => ids.has(a.id)).map((a) => {
      const c = { ...a, id: uid() } as Annotation;
      if (c.type === 'draw') c.points = c.points.map((p) => ({ x: p.x + 12, y: p.y + 12 }));
      else if ('x' in c) { c.x += 12; c.y += 12; }
      return c;
    });
    setAnnotations((prev) => [...prev, ...copies]);
    setSelectedIds(new Set(copies.map((c) => c.id)));
  }, [snapshot]);
  const moveSelectedBy = useCallback((ddx: number, ddy: number) => {
    const ids = selRef.current;
    setAnnotations((prev) => prev.map((a) => (ids.has(a.id)
      ? (a.type === 'draw' ? { ...a, points: a.points.map((p) => ({ x: p.x + ddx, y: p.y + ddy })) } : 'x' in a ? { ...a, x: a.x + ddx, y: a.y + ddy } : a)
      : a)));
  }, []);

  // interact.js
  useEffect(() => {
    const start = () => snapshot();
    const end = () => setGuides(null);
    const applyMove = (el: HTMLElement, dx: number, dy: number) => {
      const id = el.dataset.id!;
      const pageIdx = Number(el.dataset.page);
      const page = pagesRef.current[pageIdx];
      const scale = (page?.displayScale ?? 1) * zoomRef.current;
      const cur = annRef.current.find((a) => a.id === id);
      if (!cur) return;
      // Movimiento en grupo (varios seleccionados): mueve todos por el mismo delta.
      const ids = selRef.current;
      if (ids.has(id) && ids.size > 1) {
        const ddx = dx / scale;
        const ddy = dy / scale;
        setAnnotations((prev) => prev.map((a) => (ids.has(a.id)
          ? (a.type === 'draw' ? { ...a, points: a.points.map((p) => ({ x: p.x + ddx, y: p.y + ddy })) } : 'x' in a ? { ...a, x: a.x + ddx, y: a.y + ddy } : a)
          : a)));
        setGuides(null);
        return;
      }
      if (cur.type === 'draw') {
        setAnnotations((prev) => prev.map((a) => (a.id === id && a.type === 'draw' ? { ...a, points: a.points.map((p) => ({ x: p.x + dx / scale, y: p.y + dy / scale })) } : a)));
        return;
      }
      if (!('x' in cur)) return;
      let nx = cur.x + dx / scale;
      let ny = cur.y + dy / scale;
      const w = isSized(cur) ? cur.width : 0;
      const h = isSized(cur) ? cur.height : 0;
      if (page) {
        const others = annRef.current.filter((o) => o.id !== id && o.page === pageIdx).filter(isSized).map((o) => ({ x: o.x, y: o.y, w: o.width, h: o.height }));
        const snap = computeSnap({ x: nx, y: ny, w, h }, others, page.widthPt, page.heightPt, 8 / scale);
        nx = snap.x;
        ny = snap.y;
        setGuides({ page: pageIdx, vx: snap.vx, hy: snap.hy });
      }
      setAnnotations((prev) => prev.map((a) => (a.id === id ? ({ ...a, x: nx, y: ny } as Annotation) : a)));
    };
    interact('.ed-text').draggable({ allowFrom: '.ed-handle', listeners: { start, end, move: (e) => applyMove(e.target as HTMLElement, e.dx, e.dy) } });
    interact('.ed-move').draggable({ listeners: { start, end, move: (e) => applyMove(e.target as HTMLElement, e.dx, e.dy) } });
    return () => {
      interact('.ed-text').unset();
      interact('.ed-move').unset();
    };
  }, [snapshot]);

  // Atajos
  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onEscape: () => clearSel(),
    onDelete: () => removeSelected(),
    onDuplicate: () => duplicateSelected(),
    onNudge: (dx, dy) => {
      const first = annotations.find((a) => selectedIds.has(a.id));
      if (!first) return;
      const scale = pagesRef.current[first.page]?.displayScale ?? 1;
      snapshotMaybe();
      moveSelectedBy(dx / scale, dy / scale);
    },
  }, !!bytes && !result);

  // ── Factories ──
  function newText(page: number, x: number, y: number): TextAnnotation {
    return { id: uid(), type: 'text', page, x, y, text: '', size: fontSize, color, font: fontFamily, bold: false, italic: false, underline: false, align: 'left', lineHeight: 1.2, opacity: 1, rotation: 0 };
  }
  /** Coloca un sello (texto en bloque, en negrita, ligeramente inclinado) en el centro de la página visible. */
  function placeStamp(text: string, stampColor: string) {
    const idx = activePage;
    const page = pagesRef.current[idx];
    if (!page) return;
    const size = 30;
    const approxW = text.length * size * 0.58;
    const x = Math.max(8, page.widthPt / 2 - approxW / 2);
    const y = page.heightPt / 2 - size / 2;
    const a: TextAnnotation = { id: uid(), type: 'text', page: idx, x, y, text, size, color: stampColor, font: fontFamily, bold: true, italic: false, underline: false, align: 'center', lineHeight: 1.1, opacity: 0.9, rotation: -12 };
    add(a);
    selectOnly(a.id);
    setTool('select');
    toast(`Sello "${text}" añadido`, 'success');
  }

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    setAnnotations([]);
    undoStack.current = [];
    redoStack.current = [];
    setBytes(data);
  }
  function reset() {
    setBytes(null);
    setResult(null);
    setAnnotations([]);
    clearSel();
    setTool('select');
  }

  function localPoint(e: ReactPointerEvent, page: EditorPage, layer: HTMLElement): Point {
    const r = layer.getBoundingClientRect();
    return { x: (e.clientX - r.left) / page.displayScale, y: (e.clientY - r.top) / page.displayScale };
  }
  // Goma tipo pincel: borra SOLO la parte del trazo bajo la goma (parte el trazo),
  // no el trazo entero. El radio depende del grosor (con preview).
  function eraseAt(pageIndex: number, p: Point) {
    const radius = strokeWidth + 5;
    snapshotMaybe();
    setAnnotations((prev) => {
      let changed = false;
      const out: Annotation[] = [];
      for (const a of prev) {
        if (a.type === 'draw' && a.page === pageIndex) {
          const near = a.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < radius);
          if (!near) {
            out.push(a);
            continue;
          }
          changed = true;
          let run: Point[] = [];
          for (const pt of a.points) {
            if (Math.hypot(pt.x - p.x, pt.y - p.y) < radius) {
              if (run.length >= 2) out.push({ ...a, id: uid(), points: run });
              run = [];
            } else run.push(pt);
          }
          if (run.length >= 2) out.push({ ...a, id: uid(), points: run });
        } else out.push(a);
      }
      return changed ? out : prev;
    });
  }

  function onLayerDown(e: ReactPointerEvent, pageIndex: number) {
    const page = pages[pageIndex];
    if (!page) return;
    const layer = e.currentTarget as HTMLElement;
    const p = localPoint(e, page, layer);
    if (tool === 'select') {
      layer.setPointerCapture(e.pointerId);
      setMarquee({ page: pageIndex, x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    if (tool === 'text') {
      const t = newText(pageIndex, p.x, p.y);
      add(t);
      selectOnly(t.id);
      setTool('select');
      return;
    }
    if (tool === 'signature') {
      setSignOpen(true);
      return;
    }
    layer.setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      erasingRef.current = true;
      eraseAt(pageIndex, p);
    } else if (tool === 'draw') {
      setDraft({ kind: 'draw', page: pageIndex, color, width: strokeWidth, opacity: 1, points: [p] });
    } else if (tool === 'highlight' || tool === 'shape') {
      setDraft({ kind: 'rect-like', tool, shape: tool === 'shape' ? shapeKind : undefined, page: pageIndex, x: p.x, y: p.y, w: 0, h: 0 });
    }
  }
  function onLayerMove(e: ReactPointerEvent, pageIndex: number) {
    const page = pages[pageIndex];
    if (!page) return;
    if (tool === 'text') {
      const gp = localPoint(e, page, e.currentTarget as HTMLElement);
      setGhost({ page: pageIndex, x: gp.x, y: gp.y });
    }
    if (tool === 'select' && marquee && marquee.page === pageIndex) {
      const mp = localPoint(e, page, e.currentTarget as HTMLElement);
      return setMarquee({ ...marquee, w: mp.x - marquee.x, h: mp.y - marquee.y });
    }
    if (tool === 'eraser' && erasingRef.current) return eraseAt(pageIndex, localPoint(e, page, e.currentTarget as HTMLElement));
    if (!draft) return;
    const p = localPoint(e, page, e.currentTarget as HTMLElement);
    if (draft.kind === 'draw' && draft.page === pageIndex) setDraft({ ...draft, points: [...draft.points, p] });
    else if (draft.kind === 'rect-like' && draft.page === pageIndex) setDraft({ ...draft, w: p.x - draft.x, h: p.y - draft.y });
  }
  function onLayerUp() {
    erasingRef.current = false;
    if (marquee) {
      const m = marquee;
      setMarquee(null);
      if (Math.abs(m.w) < 4 && Math.abs(m.h) < 4) { clearSel(); return; }
      const box = { x: Math.min(m.x, m.x + m.w), y: Math.min(m.y, m.y + m.h), w: Math.abs(m.w), h: Math.abs(m.h) };
      const hits = annRef.current.filter((a) => a.page === m.page && rectsIntersect(annBox(a), box)).map((a) => a.id);
      setSelectedIds(new Set(hits));
      return;
    }
    if (!draft) return;
    if (draft.kind === 'draw' && draft.points.length > 1) {
      add({ id: uid(), type: 'draw', page: draft.page, color: draft.color, width: draft.width, opacity: draft.opacity, points: draft.points });
    } else if (draft.kind === 'rect-like' && Math.abs(draft.w) > 4 && Math.abs(draft.h) > 4) {
      const id = uid();
      if (draft.tool === 'highlight') {
        add({ id, type: 'highlight', page: draft.page, x: Math.min(draft.x, draft.x + draft.w), y: Math.min(draft.y, draft.y + draft.h), width: Math.abs(draft.w), height: Math.abs(draft.h), color, opacity: 0.4 });
      } else {
        const kind = draft.shape!;
        const norm = kind === 'rect' || kind === 'ellipse';
        const x = norm ? Math.min(draft.x, draft.x + draft.w) : draft.x;
        const y = norm ? Math.min(draft.y, draft.y + draft.h) : draft.y;
        const w = norm ? Math.abs(draft.w) : draft.w;
        const h = norm ? Math.abs(draft.h) : draft.h;
        add({ id, type: 'shape', kind, page: draft.page, x, y, width: w, height: h, strokeColor: color, strokeWidth, fillColor: norm ? fillColor : null, opacity: 1, rotation: 0 });
      }
      // Recién creado = seleccionado y editable al instante (sin ir a "Mover").
      selectOnly(id);
      setTool('select');
    }
    setDraft(null);
  }

  async function onImagePicked(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const data = await readFileBytes(file);
    const format = detectImageType(data);
    if (!format) return setError('Solo se admiten imágenes JPG o PNG.');
    insertImage(data, format, 160, await imageRatio(data));
  }
  function insertImage(data: Uint8Array, format: 'png' | 'jpg', width: number, ratio: number) {
    const page = pages[0];
    if (!page) return;
    const height = width / ratio;
    const a: Annotation = { id: uid(), type: 'image', page: 0, x: page.widthPt / 2 - width / 2, y: page.heightPt / 2 - height / 2, width, height, bytes: data, format, opacity: 1, rotation: 0 };
    add(a);
    selectOnly(a.id);
    setTool('select');
  }

  function bringTo(id: string, dir: 'front' | 'back' | 'up' | 'down') {
    snapshot();
    setAnnotations((prev) => {
      const i = prev.findIndex((a) => a.id === id);
      if (i < 0) return prev;
      const arr = [...prev];
      const [el] = arr.splice(i, 1);
      if (dir === 'front') arr.push(el!);
      else if (dir === 'back') arr.unshift(el!);
      else if (dir === 'up') arr.splice(Math.min(arr.length, i + 1), 0, el!);
      else arr.splice(Math.max(0, i - 1), 0, el!);
      return arr;
    });
  }
  function alignSelected(axis: 'h' | 'v') {
    if (!selected || !isSized(selected)) return;
    const page = pages[selected.page];
    if (!page) return;
    if (axis === 'h') patch(selected.id, { x: page.widthPt / 2 - selected.width / 2 });
    else patch(selected.id, { y: page.heightPt / 2 - selected.height / 2 });
  }

  async function save() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const out = await applyAnnotations(bytes, annotations);
      setResult({ bytes: out, filename: `${fileName}-editado.pdf` });
    } catch {
      setError('No se pudo guardar el PDF editado.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="edit" onReset={reset} />;
  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para editarlo: texto, formas, dibujo, resaltado, imágenes y firma." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const movable = tool === 'select';

  return (
    <>
      {signOpen && (
        <SignatureModal
          onClose={() => setSignOpen(false)}
          onConfirm={(sig) => {
            setSignOpen(false);
            insertImage(sig.bytes, sig.format, 180, sig.ratio);
          }}
        />
      )}

      <div className="flex flex-col-reverse gap-4 lg:h-full lg:flex-row lg:items-stretch lg:overflow-hidden">
        {/* Documento */}
        <div className="flex min-w-0 flex-1 gap-3 lg:h-full lg:overflow-hidden">
          {/* Minimap de páginas (navegación) */}
          {pages.length > 1 && (
            <div className="hidden w-14 shrink-0 lg:block lg:h-full lg:overflow-y-auto">
              <div className="space-y-1.5 pr-1">
                {pages.map((p, i) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => pageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className={`block w-full overflow-hidden rounded border ${activePage === i ? 'border-signal ring-1 ring-signal/40' : 'border-line hover:border-signal/50'}`}
                    title={`Página ${p.pageNumber}`}
                  >
                    <img src={p.dataUrl} alt="" className="w-full" />
                    <span className="block bg-paper-raised text-center font-mono text-[8px] text-graphite">{p.pageNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={colRef} className="min-w-0 flex-1 lg:h-full lg:overflow-y-auto lg:overflow-x-auto lg:pr-1">
          {(error || loadError) && <div className="mb-4"><ErrorAlert message={error ?? loadError!} /></div>}
          {loading && pages.length === 0 && <p className="py-8 text-center font-mono text-sm text-graphite">Cargando páginas…</p>}

          <div className="inline-flex min-w-full flex-col items-center gap-6 pb-8">
            {pages.map((page, pageIndex) => {
              const s = page.displayScale * zoom;
              const wPx = Math.round(page.widthPt * s);
              const hPx = Math.round(page.heightPt * s);
              const pageAnns = annotations.filter((a) => a.page === pageIndex);
              const cursor = tool === 'text' ? 'text' : tool === 'draw' || tool === 'highlight' || tool === 'shape' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'default';
              // Táctil: con herramientas de dibujo el dedo debe DIBUJAR (no desplazar la
              // página); en modo selección se permite el scroll vertical para navegar el PDF.
              const touchAction = tool === 'draw' || tool === 'highlight' || tool === 'shape' || tool === 'eraser' ? 'none' : 'pan-y';
              return (
                <div key={page.pageNumber} ref={(el) => { pageRefs.current[pageIndex] = el; }} data-page-idx={pageIndex} className="relative shadow-[0_4px_24px_-12px_rgba(20,22,27,0.3)] shrink-0 transition-all duration-75" style={{ width: `${wPx}px`, minWidth: `${wPx}px`, height: `${hPx}px`, minHeight: `${hPx}px` }}>
                  <img src={page.dataUrl} alt={`Página ${page.pageNumber}`} className="absolute inset-0 h-full w-full" />

                  {/* Trazos de dibujo (committed) + draft en curso */}
                  <svg className="pointer-events-none absolute inset-0" width={wPx} height={hPx}>
                    {pageAnns.map((a) => a.type === 'draw' ? (
                      <polyline key={a.id} points={a.points.map((p) => `${p.x * s},${p.y * s}`).join(' ')} fill="none" stroke={a.color} strokeWidth={a.width * s} strokeLinecap="round" strokeLinejoin="round" opacity={a.opacity} />
                    ) : null)}
                    {draft?.kind === 'draw' && draft.page === pageIndex && (
                      <polyline points={draft.points.map((p) => `${p.x * s},${p.y * s}`).join(' ')} fill="none" stroke={draft.color} strokeWidth={draft.width * s} strokeLinecap="round" />
                    )}
                    {draft?.kind === 'rect-like' && draft.page === pageIndex && (
                      <rect x={Math.min(draft.x, draft.x + draft.w) * s} y={Math.min(draft.y, draft.y + draft.h) * s} width={Math.abs(draft.w) * s} height={Math.abs(draft.h) * s} fill={draft.tool === 'highlight' ? color : 'none'} opacity={draft.tool === 'highlight' ? 0.3 : 1} stroke={draft.tool === 'shape' ? color : 'none'} strokeWidth={1.5} />
                    )}
                    {/* Guías de alineación (snap) */}
                    {guides && guides.page === pageIndex && guides.vx != null && (
                      <line x1={guides.vx * s} y1={0} x2={guides.vx * s} y2={hPx} stroke="var(--color-signal)" strokeWidth={1} strokeDasharray="4 4" />
                    )}
                    {guides && guides.page === pageIndex && guides.hy != null && (
                      <line x1={0} y1={guides.hy * s} x2={wPx} y2={guides.hy * s} stroke="var(--color-signal)" strokeWidth={1} strokeDasharray="4 4" />
                    )}
                    {/* Lazo de selección (marquesina) */}
                    {marquee && marquee.page === pageIndex && (
                      <rect x={Math.min(marquee.x, marquee.x + marquee.w) * s} y={Math.min(marquee.y, marquee.y + marquee.h) * s} width={Math.abs(marquee.w) * s} height={Math.abs(marquee.h) * s} fill="var(--color-signal)" fillOpacity={0.08} stroke="var(--color-signal)" strokeWidth={1} strokeDasharray="3 3" />
                    )}
                  </svg>

                  {/* Capa de captura (debajo de los elementos: clic en vacío = lazo/deseleccionar) */}
                  <div className="absolute inset-0" style={{ cursor, pointerEvents: 'auto', touchAction }} onPointerDown={(e) => onLayerDown(e, pageIndex)} onPointerMove={(e) => onLayerMove(e, pageIndex)} onPointerUp={onLayerUp} onPointerLeave={() => setGhost(null)} />

                  {/* Fantasma de colocación (herramienta Texto) */}
                  {tool === 'text' && ghost && ghost.page === pageIndex && (
                    <div className="pointer-events-none absolute select-none rounded border border-dashed border-signal/70 bg-signal/5 px-1 leading-tight text-signal-deep" style={{ left: ghost.x * s, top: ghost.y * s, fontSize: fontSize * s }}>Aa</div>
                  )}

                  {/* Anotaciones */}
                  {pageAnns.map((a) => renderAnnotation(a, s, pageIndex, movable, tool !== 'eraser', selectedIds.has(a.id), imageUrl, onElementClick, (id, text) => patch(id, { text }), (id) => { setTool('select'); selectOnly(id); }))}

                  {/* Marco de selección (redimensionar + rotar) — estándar DocLab */}
                  {movable && selected && selected.page === pageIndex && isSized(selected) && (
                    <SelectionFrame
                      box={selected.type === 'shape'
                        ? { x: Math.min(selected.x, selected.x + selected.width), y: Math.min(selected.y, selected.y + selected.height), width: Math.abs(selected.width), height: Math.abs(selected.height) }
                        : { x: selected.x, y: selected.y, width: selected.width, height: selected.height }}
                      rotation={'rotation' in selected ? selected.rotation : 0}
                      scale={s}
                      onStart={snapshot}
                      onChange={(partial) => patch(selected.id, partial as Partial<Annotation>, false)}
                      rotatable={selected.type !== 'highlight'}
                    />
                  )}

                  {/* Barra flotante contextual (acciones rápidas) — soporta selección múltiple */}
                  {movable && !draft && pageAnns.some((a) => selectedIds.has(a.id)) && (() => {
                    const sel = pageAnns.filter((a) => selectedIds.has(a.id));
                    const anchors = sel.map((a) => selAnchor(a, s));
                    const left = anchors.reduce((m, p) => m + p.left, 0) / anchors.length;
                    const top = Math.min(...anchors.map((p) => p.top));
                    const single = sel.length === 1 ? sel[0]! : null;
                    return (
                      <div className="absolute z-30 -translate-x-1/2" style={{ left, top: Math.max(4, top - 30), transform: 'translate(-50%, -100%)' }}>
                        <div className="flex items-center gap-0.5 rounded-md border border-line bg-paper-raised px-1 py-0.5 shadow-[0_4px_12px_rgba(20,22,27,0.18)]">
                          {sel.length > 1 && <span className="px-1.5 font-mono text-[10px] text-graphite">{sel.length}</span>}
                          <button type="button" onClick={duplicateSelected} title="Duplicar" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink"><Copy className="size-3.5" /></button>
                          {single && <button type="button" onClick={() => bringTo(single.id, 'front')} title="Traer al frente" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink"><ChevronUp className="size-3.5" /></button>}
                          {single && <button type="button" onClick={() => bringTo(single.id, 'back')} title="Enviar al fondo" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink"><ChevronDown className="size-3.5" /></button>}
                          <button type="button" onClick={removeSelected} title="Borrar" className="grid size-7 place-items-center rounded text-ember hover:bg-ember/10"><Trash2 className="size-3.5" /></button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Panel */}
        <aside className="rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-3.5 lg:h-full lg:w-80 lg:shrink-0 lg:overflow-y-auto">
          {/* Zoom + historial */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <ZoomControls zoom={zoom} onZoom={setZoom} onFit={() => setZoom(1)} />
            <div className="flex gap-1">
              <button type="button" onClick={undo} disabled={!undoStack.current.length} title="Deshacer" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink disabled:opacity-30"><Undo2 className="size-4" /></button>
              <button type="button" onClick={redo} disabled={!redoStack.current.length} title="Rehacer" className="grid size-7 place-items-center rounded text-graphite hover:bg-ink/5 hover:text-ink disabled:opacity-30"><Redo2 className="size-4" /></button>
            </div>
          </div>

          {/* Herramientas */}
          <div className="grid grid-cols-4 gap-1.5">
            <PanelTool active={tool === 'select'} onClick={() => setTool('select')} icon={MousePointer2} label="Mover" />
            <PanelTool active={tool === 'text'} onClick={() => setTool('text')} icon={Type} label="Texto" />
            <PanelTool active={tool === 'draw'} onClick={() => setTool('draw')} icon={Pencil} label="Lápiz" />
            <PanelTool active={tool === 'highlight'} onClick={() => setTool('highlight')} icon={Highlighter} label="Marcar" />
            <PanelTool active={tool === 'shape'} onClick={() => setTool('shape')} icon={Shapes} label="Forma" />
            <PanelTool active={tool === 'image'} onClick={() => { setTool('select'); imageInputRef.current?.click(); }} icon={ImagePlus} label="Imagen" />
            <PanelTool active={tool === 'signature'} onClick={() => setSignOpen(true)} icon={PenTool} label="Firma" />
            <PanelTool active={tool === 'stamp'} onClick={() => setTool('stamp')} icon={Stamp} label="Sello" />
            <PanelTool active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={Eraser} label="Goma" />
          </div>

          <div className="my-3 h-px bg-line" />

          {/* Controles contextuales */}
          <div className="space-y-3">
            {tool === 'stamp' && (
              <div className="space-y-2">
                <p className="font-mono text-xs text-graphite">Elige un sello y se coloca centrado en la página visible.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {STAMPS.map((st) => (
                    <button key={st.label} type="button" onClick={() => placeStamp(st.label, st.color)} className="rounded border border-line px-2 py-1.5 text-center text-xs font-700 tracking-wide hover:border-current" style={{ color: st.color }}>
                      {st.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => placeStamp(new Date().toLocaleDateString('es-ES'), '#0f172a')} className="col-span-2 rounded border border-line px-2 py-1.5 text-center text-xs font-700 tracking-wide text-ink hover:border-signal/50">
                    Fecha de hoy ({new Date().toLocaleDateString('es-ES')})
                  </button>
                </div>
              </div>
            )}
            {(tool === 'shape' || selected?.type === 'shape') && (
              <ShapeControls
                kind={selected?.type === 'shape' ? selected.kind : shapeKind}
                onKind={(k) => (selected?.type === 'shape' ? patch(selected.id, { kind: k }) : setShapeKind(k))}
                stroke={selected?.type === 'shape' ? selected.strokeColor : color}
                onStroke={(c) => (selected?.type === 'shape' ? patch(selected.id, { strokeColor: c }) : setColor(c))}
                strokeW={selected?.type === 'shape' ? selected.strokeWidth : strokeWidth}
                onStrokeW={(w) => (selected?.type === 'shape' ? patch(selected.id, { strokeWidth: w }) : setStrokeWidth(w))}
                fill={selected?.type === 'shape' ? selected.fillColor : fillColor}
                onFill={(c) => (selected?.type === 'shape' ? patch(selected.id, { fillColor: c }) : setFillColor(c))}
              />
            )}

            {(tool === 'text' || selected?.type === 'text') && (
              <TextControls a={selected?.type === 'text' ? selected : null} fontFamily={fontFamily} fontSize={fontSize} color={color}
                onFamily={(f) => (selected?.type === 'text' ? patch(selected.id, { font: f }) : setFontFamily(f))}
                onSize={(v) => (selected?.type === 'text' ? patch(selected.id, { size: v }) : setFontSize(v))}
                onColor={(c) => (selected?.type === 'text' ? patch(selected.id, { color: c! }) : setColor(c!))}
                onToggle={(k) => selected?.type === 'text' && patch(selected.id, { [k]: !selected[k] } as Partial<Annotation>)}
                onAlign={(al) => selected?.type === 'text' && patch(selected.id, { align: al })}
                onLineHeight={(lh) => selected?.type === 'text' && patch(selected.id, { lineHeight: lh })}
              />
            )}

            {(tool === 'draw' || selected?.type === 'draw') && (
              <>
                <Field label="Color"><ColorControl value={selected?.type === 'draw' ? selected.color : color} onChange={(c) => (selected?.type === 'draw' ? patch(selected.id, { color: c! }) : setColor(c!))} /></Field>
                <BrushSlider value={selected?.type === 'draw' ? selected.width : strokeWidth} min={1} max={20} color={selected?.type === 'draw' ? selected.color : color} onChange={(w) => (selected?.type === 'draw' ? patch(selected.id, { width: w }) : setStrokeWidth(w))} />
              </>
            )}

            {(tool === 'highlight' || selected?.type === 'highlight') && (
              <Field label="Color"><ColorControl value={selected?.type === 'highlight' ? selected.color : color} onChange={(c) => (selected?.type === 'highlight' ? patch(selected.id, { color: c! }) : setColor(c!))} /></Field>
            )}

            {/* Transformaciones de cualquier elemento seleccionado */}
            {selected && (
              <div className="space-y-2 rounded-md border border-line p-2">
                {'opacity' in selected && <LabeledSlider label="Opacidad" value={selected.opacity * 100} min={10} max={100} unit="%" onChange={(v) => patch(selected.id, { opacity: v / 100 })} />}
                {'rotation' in selected && <LabeledSlider label="Rotación" value={selected.rotation} min={0} max={360} unit="°" onChange={(v) => patch(selected.id, { rotation: v })} />}
                <div className="flex items-center justify-between gap-1">
                  <button type="button" onClick={duplicateSelected} title="Duplicar" className="grid size-8 place-items-center rounded border border-line text-graphite hover:text-ink"><Copy className="size-4" /></button>
                  <button type="button" onClick={() => bringTo(selected.id, 'front')} title="Traer al frente" className="grid size-8 place-items-center rounded border border-line text-graphite hover:text-ink"><ChevronUp className="size-4" /></button>
                  <button type="button" onClick={() => bringTo(selected.id, 'back')} title="Enviar al fondo" className="grid size-8 place-items-center rounded border border-line text-graphite hover:text-ink"><ChevronDown className="size-4" /></button>
                  {isSized(selected) && <button type="button" onClick={() => alignSelected('h')} title="Centrar H" className="grid size-8 place-items-center rounded border border-line text-graphite hover:text-ink"><RotateCw className="size-4 rotate-90" /></button>}
                  <button type="button" onClick={() => removeId(selected.id)} title="Borrar" className="grid size-8 place-items-center rounded border border-ember/40 bg-ember/10 text-ember"><Trash2 className="size-4" /></button>
                </div>
              </div>
            )}

            {/* Acciones de grupo (multi-selección) */}
            {selectedIds.size > 1 && (
              <div className="space-y-2 rounded-md border border-signal/40 bg-signal/5 p-2">
                <p className="font-mono text-xs text-signal-deep">{selectedIds.size} elementos seleccionados</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={duplicateSelected} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-line py-1.5 text-sm text-ink hover:border-signal/50"><Copy className="size-4" /> Duplicar</button>
                  <button type="button" onClick={removeSelected} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-ember/40 bg-ember/10 py-1.5 text-sm text-ember"><Trash2 className="size-4" /> Borrar</button>
                </div>
              </div>
            )}
          </div>

          <div className="my-3 h-px bg-line" />
          <Button onClick={save} loading={busy} className="w-full"><Save className="size-4" aria-hidden /> Guardar PDF</Button>
          <button type="button" onClick={reset} className="mt-2 w-full text-center text-xs text-graphite hover:text-ink">Cambiar archivo</button>
        </aside>
      </div>

      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { onImagePicked(e.target.files); e.target.value = ''; }} />
    </>
  );
}

// ── Render de cada anotación (wrapper rotado + contenido) ──
function renderAnnotation(a: Annotation, s: number, pageIndex: number, movable: boolean, clickable: boolean, isSel: boolean, imageUrl: (id: string, b: Uint8Array) => string, select: (id: string, shift: boolean) => void, onText: (id: string, text: string) => void, onActivate: (id: string) => void) {
  const common = { 'data-id': a.id, 'data-page': pageIndex, onPointerDown: (e: ReactPointerEvent) => select(a.id, e.shiftKey) } as const;
  const pe = clickable ? 'auto' : 'none';
  const ring = isSel ? 'ring-2 ring-signal' : '';

  if (a.type === 'text') {
    return (
      <div key={a.id} {...common} onDoubleClick={(e) => { onActivate(a.id); (e.currentTarget.querySelector('textarea') as HTMLTextAreaElement | null)?.focus(); }} className={`ed-text group absolute ${isSel ? 'ring-1 ring-signal/60' : ''}`} style={{ left: a.x * s, top: a.y * s, transform: `rotate(${a.rotation}deg)`, transformOrigin: 'center', opacity: a.opacity, pointerEvents: clickable ? 'auto' : 'none' }}>
        {movable && <span className="ed-handle absolute -left-5 top-0 cursor-grab text-graphite opacity-0 group-hover:opacity-100" title="Mover"><GripVertical className="size-4" /></span>}
        {movable && <span className="ed-handle absolute -top-4 left-0 flex h-4 w-full cursor-grab items-center justify-center rounded-t bg-signal/15 text-signal-deep opacity-0 group-hover:opacity-100" title="Mover"><GripVertical className="size-3 rotate-90" /></span>}
        <textarea value={a.text} onChange={(e) => onText(a.id, e.target.value)} rows={Math.max(1, a.text.split('\n').length)} cols={Math.max(8, ...a.text.split('\n').map((l) => l.length + 1))} placeholder="Escribe…" spellCheck={false} className="ed-textarea resize-none overflow-hidden bg-transparent leading-tight outline-none"
          style={{ color: a.color, fontSize: a.size * s, fontFamily: FONTS[a.font].css, fontWeight: a.bold ? 700 : 400, fontStyle: a.italic ? 'italic' : 'normal', textDecoration: a.underline ? 'underline' : 'none', textAlign: a.align, lineHeight: a.lineHeight }} />
      </div>
    );
  }
  if (a.type === 'image') {
    return (
      <div key={a.id} {...common} className={`ed-move absolute ${ring}`} style={{ left: a.x * s, top: a.y * s, width: a.width * s, height: a.height * s, transform: `rotate(${a.rotation}deg)`, transformOrigin: 'center', opacity: a.opacity, pointerEvents: pe, cursor: movable ? 'move' : 'default' }}>
        <img src={imageUrl(a.id, a.bytes)} alt="" className="h-full w-full select-none" draggable={false} />
      </div>
    );
  }
  if (a.type === 'highlight') {
    return <div key={a.id} {...common} className={`ed-move absolute ${ring}`} style={{ left: a.x * s, top: a.y * s, width: a.width * s, height: a.height * s, backgroundColor: a.color, opacity: a.opacity, pointerEvents: pe, cursor: movable ? 'move' : 'default' }} />;
  }
  if (a.type === 'shape') {
    const w = Math.abs(a.width) * s;
    const h = Math.abs(a.height) * s;
    const left = Math.min(a.x, a.x + a.width) * s;
    const top = Math.min(a.y, a.y + a.height) * s;
    return (
      <div key={a.id} {...common} className={`ed-move absolute ${ring}`} style={{ left, top, width: Math.max(8, w), height: Math.max(8, h), transform: `rotate(${a.rotation}deg)`, transformOrigin: 'center', opacity: a.opacity, pointerEvents: pe, cursor: movable ? 'move' : 'default' }}>
        <ShapeSvg a={a} w={Math.max(8, w)} h={Math.max(8, h)} s={s} />
      </div>
    );
  }
  // draw: la polilínea se pinta en el SVG de página; aquí solo la caja de interacción/selección.
  const bb = drawBBox(a.points);
  return (
    <div key={a.id} {...common} className={`ed-move absolute ${isSel ? 'ring-1 ring-signal' : ''}`} style={{ left: bb.x * s, top: bb.y * s, width: Math.max(8, bb.w * s), height: Math.max(8, bb.h * s), pointerEvents: clickable ? 'auto' : 'none', cursor: movable ? 'move' : 'default' }} />
  );
}

function ShapeSvg({ a, w, h, s }: { a: ShapeAnnotation; w: number; h: number; s: number }) {
  const sw = a.strokeWidth * s;
  if (a.kind === 'rect') return <svg width={w} height={h} className="absolute inset-0"><rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} fill={a.fillColor ?? 'none'} stroke={a.strokeColor} strokeWidth={sw} /></svg>;
  if (a.kind === 'ellipse') return <svg width={w} height={h} className="absolute inset-0"><ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - sw / 2)} ry={Math.max(0, h / 2 - sw / 2)} fill={a.fillColor ?? 'none'} stroke={a.strokeColor} strokeWidth={sw} /></svg>;
  // line / arrow
  const x1 = a.width >= 0 ? 0 : w, y1 = a.height >= 0 ? 0 : h, x2 = a.width >= 0 ? w : 0, y2 = a.height >= 0 ? h : 0;
  return (
    <svg width={w} height={h} className="absolute inset-0" style={{ overflow: 'visible' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={a.strokeColor} strokeWidth={sw} strokeLinecap="round" />
      {a.kind === 'arrow' && <ArrowHead x1={x1} y1={y1} x2={x2} y2={y2} color={a.strokeColor} sw={sw} />}
    </svg>
  );
}
function ArrowHead({ x1, y1, x2, y2, color, sw }: { x1: number; y1: number; x2: number; y2: number; color: string; sw: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(8, sw * 3);
  const wing = Math.PI / 7;
  const a1 = ang + Math.PI - wing;
  const a2 = ang + Math.PI + wing;
  return (
    <g stroke={color} strokeWidth={sw} strokeLinecap="round">
      <line x1={x2} y1={y2} x2={x2 + head * Math.cos(a1)} y2={y2 + head * Math.sin(a1)} />
      <line x1={x2} y1={y2} x2={x2 + head * Math.cos(a2)} y2={y2 + head * Math.sin(a2)} />
    </g>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-graphite">{label}</p>
      {children}
    </div>
  );
}

function PanelTool({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Type; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] transition-colors ${active ? 'bg-ink text-paper' : 'text-graphite hover:bg-ink/5 hover:text-ink'}`}>
      <Icon className="size-4" aria-hidden /> {label}
    </button>
  );
}

function ShapeControls({ kind, onKind, stroke, onStroke, strokeW, onStrokeW, fill, onFill }: { kind: ShapeKind; onKind: (k: ShapeKind) => void; stroke: string; onStroke: (c: string) => void; strokeW: number; onStrokeW: (w: number) => void; fill: string | null; onFill: (c: string | null) => void }) {
  const filled = kind === 'rect' || kind === 'ellipse';
  return (
    <>
      <Field label="Forma">
        <Segmented value={kind} onChange={onKind} options={[
          { value: 'rect', icon: <Square className="size-3.5" />, title: 'Rectángulo' },
          { value: 'ellipse', icon: <Circle className="size-3.5" />, title: 'Elipse' },
          { value: 'line', icon: <Minus className="size-3.5" />, title: 'Línea' },
          { value: 'arrow', icon: <ArrowRight className="size-3.5" />, title: 'Flecha' },
        ]} />
      </Field>
      <Field label="Trazo"><ColorControl value={stroke} onChange={(c) => onStroke(c!)} /></Field>
      <BrushSlider value={strokeW} min={1} max={16} color={stroke} label="Grosor" onChange={onStrokeW} />
      {filled && <Field label="Relleno"><ColorControl value={fill} onChange={onFill} allowNull /></Field>}
    </>
  );
}

function TextControls({ a, fontFamily, fontSize, color, onFamily, onSize, onColor, onToggle, onAlign, onLineHeight }: {
  a: TextAnnotation | null; fontFamily: FontFamily; fontSize: number; color: string;
  onFamily: (f: FontFamily) => void; onSize: (v: number) => void; onColor: (c: string | null) => void;
  onToggle: (k: 'bold' | 'italic' | 'underline') => void; onAlign: (al: TextAlign) => void; onLineHeight: (lh: number) => void;
}) {
  const fam = a?.font ?? fontFamily;
  const size = a?.size ?? fontSize;
  const col = a?.color ?? color;
  return (
    <>
      <Field label="Tipografía">
        <Segmented value={fam} onChange={onFamily} options={(Object.keys(FONTS) as FontFamily[]).map((f) => ({ value: f, label: FONTS[f].label }))} />
      </Field>
      <Field label="Color"><ColorControl value={col} onChange={onColor} /></Field>
      <LabeledSlider label="Tamaño" value={size} min={8} max={96} unit="pt" onChange={onSize} />
      {a && (
        <>
          <div className="flex items-center gap-1.5">
            <ToggleIcon active={a.bold} onClick={() => onToggle('bold')} title="Negrita"><Bold className="size-4" /></ToggleIcon>
            <ToggleIcon active={a.italic} onClick={() => onToggle('italic')} title="Cursiva"><Italic className="size-4" /></ToggleIcon>
            <ToggleIcon active={a.underline} onClick={() => onToggle('underline')} title="Subrayado"><Underline className="size-4" /></ToggleIcon>
            <span className="mx-0.5 h-6 w-px bg-line" />
            <ToggleIcon active={a.align === 'left'} onClick={() => onAlign('left')} title="Izquierda"><AlignLeft className="size-4" /></ToggleIcon>
            <ToggleIcon active={a.align === 'center'} onClick={() => onAlign('center')} title="Centro"><AlignCenter className="size-4" /></ToggleIcon>
            <ToggleIcon active={a.align === 'right'} onClick={() => onAlign('right')} title="Derecha"><AlignRight className="size-4" /></ToggleIcon>
          </div>
          <LabeledSlider label="Interlineado" value={a.lineHeight * 100} min={90} max={250} unit="%" onChange={(v) => onLineHeight(v / 100)} />
        </>
      )}
    </>
  );
}

async function imageRatio(bytes: Uint8Array): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer]));
    const img = new Image();
    img.onload = () => { resolve(img.naturalWidth / img.naturalHeight || 1); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(1); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
