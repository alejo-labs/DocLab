import { useEffect, useState } from 'react';
import { Loader2, Lightbulb } from 'lucide-react';
import { FACTS, nextFactIndex } from '../lib/facts';

/**
 * Pantalla de carga con curiosidades rotativas. Se usa mientras se descarga el motor de
 * una herramienta (Suspense). Convierte la espera en algo ameno y refuerza la tesis
 * local-first sin ser intrusiva. Respeta `prefers-reduced-motion` (vía CSS global).
 */
export function LoadingFacts({ label = 'Cargando la herramienta…' }: { label?: string }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));

  useEffect(() => {
    const id = window.setInterval(() => setI((prev) => nextFactIndex(prev)), 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid place-items-center py-20" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-6 text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-signal-deep" aria-hidden />
        <p className="mt-3 font-mono text-xs uppercase tracking-wide text-graphite">{label}</p>
        <div className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-instrument)] border border-signal/20 bg-signal/5 px-4 py-3 text-left">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-signal-deep" aria-hidden />
          <p key={i} className="doclab-fact-in text-sm text-ink">
            <span className="font-semibold text-signal-deep">¿Sabías que…?</span> {FACTS[i]}
          </p>
        </div>
      </div>
    </div>
  );
}
