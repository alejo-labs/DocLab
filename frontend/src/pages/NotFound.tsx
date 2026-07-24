import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/usePageMeta';

export function NotFound() {
  usePageMeta('Página no encontrada · DocLab');
  return (
    <section className="mx-auto grid max-w-xl place-items-center px-5 py-28 text-center">
      <p className="font-mono text-sm text-signal-deep">404</p>
      <h1 className="mt-2 font-display text-3xl font-700 tracking-tight text-ink">
        Ese instrumento no existe
      </h1>
      <p className="mt-2 text-graphite">La página que buscas no está disponible.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-[var(--radius-instrument)] bg-ink px-5 py-3 font-medium text-paper transition-colors hover:bg-ink-soft"
      >
        Volver al inicio
      </Link>
    </section>
  );
}
