import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2, X, ZoomIn } from 'lucide-react';

/* ── Tipos ──────────────────────────────────────────────────────────────────── */

export interface LightboxPage {
  /** Texto mostrado como etiqueta (p.ej. "Página 3" o nombre del archivo). */
  label: string;
  /** Data URL de la miniatura existente (se muestra al instante). */
  previewUrl: string;
}

interface PageLightboxProps {
  pages: LightboxPage[];
  initialIndex: number;
  /**
   * Renderizado HD opcional: recibe el índice de la página y devuelve un
   * data URL de alta resolución. Se llama en segundo plano tras abrir el
   * lightbox; mientras tanto se muestra la miniatura existente.
   */
  renderHd?: (index: number) => Promise<string>;
  onClose: () => void;
}

/* ── Botón de apertura (lupa) ───────────────────────────────────────────────── */

/**
 * Icono de lupa que aparece en la esquina de una miniatura para abrir el
 * lightbox. Se usa en herramientas donde el clic principal ya tiene otra
 * función (p.ej. seleccionar en SplitTool).
 */
export function LightboxTrigger({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="grid size-7 place-items-center rounded-md bg-ink/60 text-paper shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-signal-deep"
      aria-label="Ampliar página"
    >
      <ZoomIn className="size-3.5" />
    </button>
  );
}

/* ── Componente Lightbox ────────────────────────────────────────────────────── */

export function PageLightbox({ pages, initialIndex, renderHd, onClose }: PageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [hdUrls, setHdUrls] = useState<Record<number, string>>({});
  const [loadingHd, setLoadingHd] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const page = pages[index];
  const hdUrl = hdUrls[index];
  const displayUrl = hdUrl ?? page?.previewUrl;

  // ── Renderizado HD bajo demanda ──
  useEffect(() => {
    if (!renderHd || hdUrls[index]) return;
    let cancelled = false;
    setLoadingHd(true);
    renderHd(index)
      .then((url) => { if (!cancelled) setHdUrls((prev) => ({ ...prev, [index]: url })); })
      .catch(() => { /* la miniatura baja resolución sigue mostrándose */ })
      .finally(() => { if (!cancelled) setLoadingHd(false); });
    return () => { cancelled = true; };
  }, [index, renderHd, hdUrls]);

  // ── Navegación con teclado ──
  const go = useCallback((dir: -1 | 1) => {
    setIndex((prev) => {
      const next = prev + dir;
      if (next < 0 || next >= pages.length) return prev;
      return next;
    });
  }, [pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') { go(-1); return; }
      if (e.key === 'ArrowRight') { go(1); return; }
      if (e.key === 'Tab') {
        // Trap de foco: el tabulador circula solo por los controles del modal.
        const nodes = overlayRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        const activeEl = document.activeElement as HTMLElement | null;
        const inside = overlayRef.current?.contains(activeEl);
        if (e.shiftKey && (activeEl === first || !inside)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (activeEl === last || !inside)) { e.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go]);

  // ── Trap de foco: foco inicial en el overlay ──
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  // ── Bloquear scroll del body ──
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!page) return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${page.label} — vista ampliada`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center outline-none doclab-lightbox-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Fondo oscuro */}
      <div className="absolute inset-0 bg-black/80" aria-hidden />

      {/* Contenido */}
      <div className="relative flex max-h-[95dvh] max-w-[95vw] flex-col items-center gap-3 doclab-lightbox-img-in">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 grid size-8 place-items-center rounded-full bg-ink/80 text-paper shadow-lg hover:bg-ink sm:-right-10 sm:-top-1"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>

        {/* Imagen */}
        <div className="relative flex items-center justify-center">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={page.label}
              className="max-h-[82dvh] max-w-[90vw] rounded-md bg-white object-contain shadow-2xl sm:max-h-[85dvh]"
              draggable={false}
            />
          ) : (
            <div className="grid h-[60dvh] w-[42vw] max-w-[520px] place-items-center rounded-md bg-white/5">
              <Loader2 className="size-8 animate-spin text-paper/70" />
            </div>
          )}
          {displayUrl && loadingHd && !hdUrl && (
            <span className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-full bg-black/60 text-white">
              <Loader2 className="size-4 animate-spin" />
            </span>
          )}
        </div>

        {/* Barra inferior: navegación + etiqueta */}
        <div className="flex w-full items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="grid size-9 place-items-center rounded-full bg-ink/60 text-paper transition-colors hover:bg-ink/80 disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-5" />
          </button>

          <span className="font-mono text-xs text-paper/80">
            {page.label} — {index + 1} / {pages.length}
          </span>

          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === pages.length - 1}
            className="grid size-9 place-items-center rounded-full bg-ink/60 text-paper transition-colors hover:bg-ink/80 disabled:opacity-30"
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
