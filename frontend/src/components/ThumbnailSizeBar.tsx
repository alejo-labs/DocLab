import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, Grid3X3 } from 'lucide-react';

/* ── Heurística de auto-sizing ──────────────────────────────────────────────── */

function computeAutoSize(pageCount: number): number {
  if (pageCount <= 4) return 220;
  if (pageCount <= 15) return 170;
  if (pageCount <= 40) return 140;
  if (pageCount <= 80) return 110;
  return 90;
}

const THUMB_MIN = 80;
const THUMB_MAX = 280;
const THUMB_STEP = 10;

/* ── Hook ───────────────────────────────────────────────────────────────────── */

/**
 * Calcula un tamaño de miniatura adaptado al número de páginas y expone un
 * setter para que el usuario lo ajuste manualmente con el slider.
 */
export function useThumbnailSize(pageCount: number) {
  const [manualSize, setManualSize] = useState<number | null>(null);
  const autoSize = computeAutoSize(pageCount);

  // Al cargar un documento (0 → N) o vaciarlo (N → 0) volvemos al auto-sizing,
  // descartando el ajuste manual del documento anterior.
  const wasEmpty = useRef(pageCount === 0);
  useEffect(() => {
    const isEmpty = pageCount === 0;
    if (isEmpty !== wasEmpty.current) {
      wasEmpty.current = isEmpty;
      setManualSize(null);
    }
  }, [pageCount]);

  const thumbSize = manualSize ?? autoSize;

  return {
    thumbSize,
    setThumbSize: setManualSize,
    autoSize,
    /** Estilo inline para la rejilla (Tailwind no soporta clases dinámicas). */
    gridStyle: { gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))` } as CSSProperties,
  } as const;
}

/* ── Componente ─────────────────────────────────────────────────────────────── */

interface ThumbnailSizeBarProps {
  thumbSize: number;
  onChange: (size: number) => void;
}

/**
 * Barra compacta con un slider para ajustar el tamaño de las miniaturas.
 * Se integra en la barra de stats de cada herramienta.
 */
export function ThumbnailSizeBar({ thumbSize, onChange }: ThumbnailSizeBarProps) {
  return (
    <div className="flex items-center gap-1.5" title="Tamaño de miniaturas">
      <Grid3X3 className="size-3.5 shrink-0 text-graphite" aria-hidden />
      <input
        type="range"
        min={THUMB_MIN}
        max={THUMB_MAX}
        step={THUMB_STEP}
        value={thumbSize}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 accent-signal sm:w-24"
        aria-label="Tamaño de miniaturas"
      />
      <LayoutGrid className="size-3.5 shrink-0 text-graphite" aria-hidden />
    </div>
  );
}
