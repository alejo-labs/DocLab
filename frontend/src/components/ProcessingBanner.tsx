import { useEffect, useState } from 'react';
import { ShieldCheck, Server, Loader2 } from 'lucide-react';
import type { Processing } from '../lib/tools';
import { subscribeProcessing } from '../lib/processing';

/**
 * Banner transversal de privacidad que aparece mientras CUALQUIER herramienta procesa.
 * Refuerza la tesis central de DocLab: el procesamiento ocurre en tu dispositivo (o en un
 * contenedor efímero sin retención). Se monta una sola vez en AppShell.
 */
export function ProcessingBanner() {
  const [active, setActive] = useState<Processing | null>(null);

  useEffect(() => subscribeProcessing(setActive), []);

  if (!active) return null;

  const onDevice = active === 'on-device';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div className={`doclab-processing-in flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-xs shadow-[0_8px_28px_-8px_rgba(20,22,27,0.35)] backdrop-blur ${onDevice ? 'border-signal/40 bg-signal/10 text-signal-deep' : 'border-ember/40 bg-ember/10 text-ember'}`}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {onDevice ? (
          <>
            <span className="font-semibold tracking-wide">Procesando en tu dispositivo</span>
            <span className="hidden opacity-80 sm:inline">· ningún archivo se sube</span>
            <ShieldCheck className="size-3.5" aria-hidden />
          </>
        ) : (
          <>
            <span className="font-semibold tracking-wide">Procesando en contenedor efímero</span>
            <span className="hidden opacity-80 sm:inline">· sin retención, se purga al terminar</span>
            <Server className="size-3.5" aria-hidden />
          </>
        )}
      </div>
    </div>
  );
}
