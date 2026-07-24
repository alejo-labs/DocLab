import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Construction, Loader2 } from 'lucide-react';
import { getToolBySlug } from '../lib/tools';
import { OnDeviceBadge } from '../components/OnDeviceBadge';
import { ProcessingTypeContext } from '../lib/processing';
import { TOOL_COMPONENTS } from '../components/tools/registry';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NotFound } from './NotFound';

/**
 * Cabecera común de cada herramienta + zona de trabajo. En la Fase 0 el cuerpo es
 * un placeholder; la Fase 1/2 monta aquí cada motor de PDF.
 */
export function ToolPage() {
  const { slug } = useParams();
  const tool = slug ? getToolBySlug(slug) : undefined;

  if (!tool) {
    return <NotFound />;
  }

  const Icon = tool.icon;
  // Las herramientas marcadas como "en desarrollo" (available:false) no montan su motor.
  const ToolEngine = tool.available ? TOOL_COMPONENTS[tool.engineId] : undefined;
  const widthClass = tool.layout === 'wide' ? 'max-w-[1600px]' : 'max-w-5xl';

  return (
    <section className={`mx-auto ${widthClass} px-5 pt-8 pb-20`}>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-graphite transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Todos los instrumentos
      </Link>

      <header className="mt-6 flex items-start gap-4">
        <span className="grid size-12 place-items-center rounded-[10px] border border-line bg-paper-raised text-signal-deep">
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl font-700 tracking-tight text-ink">{tool.name}</h1>
          <p className="mt-1 max-w-xl text-graphite">{tool.description}</p>
          <div className="mt-3">
            <OnDeviceBadge processing={tool.processing} size="md" />
          </div>
        </div>
      </header>

      <div className="mt-8">
        {ToolEngine ? (
          <ErrorBoundary label={tool.name} resetKey={tool.slug}>
            <Suspense
              fallback={
                <div className="grid place-items-center py-16 text-graphite">
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                </div>
              }
            >
              <ProcessingTypeContext value={tool.processing}>
                <ToolEngine preset={tool.preset} />
              </ProcessingTypeContext>
            </Suspense>
          </ErrorBoundary>
        ) : (
          <div className="grid place-items-center rounded-[var(--radius-instrument)] border border-dashed border-line bg-paper-raised p-16 text-center">
            <Construction className="size-8 text-ember" aria-hidden />
            <p className="mt-3 font-display text-lg font-600 text-ink">En construcción</p>
            <p className="mt-1 max-w-sm text-sm text-graphite">
              El motor de «{tool.name}» se conecta en la siguiente fase. La base segura ya está lista.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
