import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Primitivos de maquetación para las páginas de contenido (Cómo funciona, Seguridad,
 * Sobre, legales). Mantienen una estética coherente con el sistema de marca DocLab
 * (instrumento de laboratorio): kicker mono, títulos display, texto graphite.
 */

/** Cabecera de página: etiqueta superior + título + entradilla. */
export function PageHero({ kicker, title, lead }: { kicker: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <header className="mx-auto max-w-3xl px-5 pt-16 pb-10 text-center sm:pt-20">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-signal-deep">{kicker}</p>
      <h1 className="mt-3 font-display text-4xl font-700 tracking-tight text-ink sm:text-5xl">{title}</h1>
      {lead && <p className="mx-auto mt-5 max-w-2xl text-lg text-graphite">{lead}</p>}
    </header>
  );
}

/** Contenedor central estrecho, pensado para lectura larga. */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-3xl px-5 pb-24 ${className}`}>{children}</div>;
}

/** Sección con título anclable. */
export function Section({ id, title, children }: { id?: string; title?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 first:mt-0">
      {title && <h2 className="font-display text-2xl font-700 tracking-tight text-ink">{title}</h2>}
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-graphite">{children}</div>
    </section>
  );
}

/** Tarjeta con icono para destacar un punto. */
export function FeatureCard({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
  return (
    <article className="flex gap-4 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-line bg-paper text-signal-deep">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <h3 className="font-display text-base font-600 tracking-tight text-ink">{title}</h3>
        <p className="mt-1 text-sm text-graphite">{children}</p>
      </div>
    </article>
  );
}

/** Fila de definición (término técnico → explicación), para tablas de datos/derechos. */
export function DefRow({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-6">
      <dt className="font-medium text-ink">{term}</dt>
      <dd className="text-sm text-graphite">{children}</dd>
    </div>
  );
}

/** Bloque de código/valor técnico en monospace (p. ej. una cabecera CSP). */
export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[0.85em] text-ink">{children}</code>
  );
}
