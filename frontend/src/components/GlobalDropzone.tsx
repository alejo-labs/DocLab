import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileUp, ShieldCheck } from 'lucide-react';
import { setHandoff } from '../lib/handoff';
import { looksLikePdf, readFileBytes } from '../lib/files';
import { toast } from '../lib/notify/toast';

/**
 * Soltar un PDF en CUALQUIER parte de la app lo abre en el editor (con overlay de aviso).
 * Se desactiva dentro de las páginas de herramienta (`/h/...`), donde manda su propio dropzone,
 * para no secuestrar drops con intención específica (p. ej. añadir a "Unir").
 */
export function GlobalDropzone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const enabled = !location.pathname.startsWith('/h/');

  useEffect(() => {
    if (!enabled) {
      setDragging(false);
      depth.current = 0;
      return;
    }
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types?.includes('Files');

    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth.current += 1;
      setDragging(true);
    }
    function onOver(e: DragEvent) {
      if (hasFiles(e)) e.preventDefault();
    }
    function onLeave() {
      depth.current -= 1;
      if (depth.current <= 0) {
        depth.current = 0;
        setDragging(false);
      }
    }
    async function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const bytes = await readFileBytes(file);
      if (!looksLikePdf(bytes)) {
        toast('Aquí solo se abren PDF. Para otros formatos, entra en la herramienta concreta.', 'error');
        return;
      }
      setHandoff({ bytes, filename: file.name });
      navigate('/h/editar-pdf');
    }

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled, navigate]);

  if (!dragging) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-ink/55 p-6 backdrop-blur-sm">
      <div className="doclab-processing-in flex flex-col items-center gap-3 rounded-[var(--radius-instrument)] border-2 border-dashed border-paper/70 bg-paper/10 px-12 py-10 text-center text-paper">
        <FileUp className="size-12" aria-hidden />
        <p className="font-display text-2xl font-700">Suelta tu PDF para abrirlo</p>
        <p className="flex items-center gap-1.5 font-mono text-xs text-paper/80">
          <ShieldCheck className="size-3.5" aria-hidden />
          Se abre en el editor, 100% en tu dispositivo
        </p>
      </div>
    </div>
  );
}
