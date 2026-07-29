import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionFrameProps {
  box: FrameBox; // en puntos de página
  rotation: number; // grados (horario en pantalla)
  scale: number; // displayScale (px por punto)
  onStart: () => void; // snapshot una vez al empezar
  onChange: (partial: Partial<FrameBox> & { rotation?: number }) => void;
  rotatable?: boolean;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: { h: Handle; cx: number; cy: number; cursor: string }[] = [
  { h: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { h: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { h: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { h: 'e', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { h: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { h: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { h: 'sw', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { h: 'w', cx: 0, cy: 0.5, cursor: 'ew-resize' },
];

const CFG: Record<Handle, { dw: number; dh: number; sx: number; sy: number; corner: boolean }> = {
  e: { dw: 1, dh: 0, sx: 1, sy: 0, corner: false },
  w: { dw: -1, dh: 0, sx: -1, sy: 0, corner: false },
  s: { dw: 0, dh: 1, sx: 0, sy: 1, corner: false },
  n: { dw: 0, dh: -1, sx: 0, sy: -1, corner: false },
  se: { dw: 1, dh: 1, sx: 1, sy: 1, corner: true },
  ne: { dw: 1, dh: -1, sx: 1, sy: -1, corner: true },
  sw: { dw: -1, dh: 1, sx: -1, sy: 1, corner: true },
  nw: { dw: -1, dh: -1, sx: -1, sy: -1, corner: true },
};

function rotateScreen(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Marco de selección estándar de DocLab (estilo Canva): tiradores en esquinas y
 * lados para redimensionar + tirador superior para rotar. Funciona con cualquier
 * rotación (mantiene fijo el lado opuesto moviendo el centro). El centro deja
 * pasar el puntero para poder ARRASTRAR el elemento que hay debajo.
 */
export function SelectionFrame({ box, rotation, scale, onStart, onChange, rotatable = true }: SelectionFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle | 'rot'; sx: number; sy: number; box: FrameBox; cx: number; cy: number } | null>(null);

  function startResize(e: ReactPointerEvent, handle: Handle) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onStart();
    drag.current = { handle, sx: e.clientX, sy: e.clientY, box: { ...box }, cx: 0, cy: 0 };
  }
  function startRotate(e: ReactPointerEvent) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onStart();
    const r = ref.current!.getBoundingClientRect();
    drag.current = { handle: 'rot', sx: e.clientX, sy: e.clientY, box: { ...box }, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }
  function onMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (d.handle === 'rot') {
      const ang = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      onChange({ rotation: ((Math.round(ang) % 360) + 360) % 360 });
      return;
    }
    const cfg = CFG[d.handle];
    const dPage = { x: (e.clientX - d.sx) / scale, y: (e.clientY - d.sy) / scale };
    const dl = rotateScreen(dPage.x, dPage.y, -rotation);
    let dW = cfg.dw * dl.x;
    let dH = cfg.dh * dl.y;
    if (cfg.corner && e.shiftKey) {
      // mantener proporción
      const ratio = d.box.width / d.box.height;
      if (Math.abs(dW) > Math.abs(dH * ratio)) dH = dW / ratio;
      else dW = dH * ratio;
    }
    const newW = Math.max(8, d.box.width + dW);
    const newH = Math.max(8, d.box.height + dH);
    const realDW = newW - d.box.width;
    const realDH = newH - d.box.height;
    const localShift = { x: cfg.sx * realDW / 2, y: cfg.sy * realDH / 2 };
    const world = rotateScreen(localShift.x, localShift.y, rotation);
    const oldCx = d.box.x + d.box.width / 2;
    const oldCy = d.box.y + d.box.height / 2;
    const newCx = oldCx + world.x;
    const newCy = oldCy + world.y;
    onChange({ x: newCx - newW / 2, y: newCy - newH / 2, width: newW, height: newH });
  }
  function onUp() {
    drag.current = null;
  }

  const left = box.x * scale;
  const top = box.y * scale;
  const w = box.width * scale;
  const h = box.height * scale;

  return (
    <div ref={ref} className="pointer-events-none absolute z-10" style={{ left, top, width: w, height: h, transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}>
      <div className="absolute inset-0 border border-signal" />
      {rotatable && (
        <div
          onPointerDown={startRotate}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="pointer-events-auto absolute left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border border-signal bg-paper"
          style={{ top: -26, touchAction: 'none' }}
          title="Rotar"
        />
      )}
      {HANDLES.map((hd) => (
        <div
          key={hd.h}
          onPointerDown={(e) => startResize(e, hd.h)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="pointer-events-auto absolute size-2.5 rounded-sm border border-signal bg-paper"
          style={{ left: `calc(${hd.cx * 100}% - 5px)`, top: `calc(${hd.cy * 100}% - 5px)`, cursor: hd.cursor, touchAction: 'none' }}
        />
      ))}
    </div>
  );
}
