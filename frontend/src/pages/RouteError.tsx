import { Link, useRouteError } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/** Red de seguridad del router: cualquier error no capturado muestra esta página amable. */
export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error('[RouteError]', error);
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-5 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-full border border-ember/40 bg-ember/10 text-ember">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-700 tracking-tight text-ink">Se produjo un error inesperado</h1>
        <p className="mt-2 text-graphite">
          Puedes recargar o volver al inicio. Todo se procesa en tu dispositivo, así que tus archivos están a salvo.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft">
            <RotateCcw className="size-4" aria-hidden /> Recargar
          </button>
          <Link to="/" className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-signal/50">
            <Home className="size-4" aria-hidden /> Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
