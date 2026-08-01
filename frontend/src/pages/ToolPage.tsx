import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Construction, Monitor } from 'lucide-react';
import { getToolBySlug } from '../lib/tools';
import { OnDeviceBadge } from '../components/OnDeviceBadge';
import { ProcessingTypeContext } from '../lib/processing';
import { TOOL_COMPONENTS } from '../components/tools/registry';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingFacts } from '../components/LoadingFacts';
import { usePageMeta } from '../lib/usePageMeta';
import { NotFound } from './NotFound';
import { ActiveDocProvider, useActiveDoc } from '../lib/activeDocContext';

export function ToolPage() {
  return (
    <ActiveDocProvider>
      <ToolPageContent />
    </ActiveDocProvider>
  );
}

function ToolPageContent() {
  const { slug } = useParams();
  const tool = slug ? getToolBySlug(slug) : undefined;
  const { hasActiveDoc } = useActiveDoc();

  usePageMeta(
    tool ? `${tool.name} · DocLab` : '',
    tool ? `${tool.description} Gratis y 100% en tu navegador, sin subir archivos.` : undefined,
  );

  if (!tool) {
    return <NotFound />;
  }

  const Icon = tool.icon;
  const ToolEngine = tool.available ? TOOL_COMPONENTS[tool.engineId] : undefined;
  const wideEngines = ['merge', 'split', 'organize', 'pdf-to-images', 'edit', 'forms', 'redact'];
  const wide = tool.layout === 'wide' || wideEngines.includes(tool.engineId);
  const widthClass = wide ? 'max-w-[1700px]' : 'max-w-6xl';
  const desktopRecommended = tool.available && ['edit', 'forms', 'redact'].includes(tool.engineId);

  return (
    <section className={`mx-auto ${widthClass} ${hasActiveDoc ? 'px-3 pt-2 pb-2 sm:px-5 lg:h-[calc(100vh-4rem)] lg:flex lg:flex-col lg:overflow-hidden' : 'px-5 pt-8 pb-20'}`}>
      {!hasActiveDoc ? (
        <>
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

          {desktopRecommended && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-instrument)] border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember sm:hidden">
              <Monitor className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Esta herramienta está pensada para ordenador. En el móvil, gestos como dibujar, arrastrar o redimensionar pueden resultar incómodos.</span>
            </div>
          )}
        </>
      ) : (
        /* Barra de cabecera ultra-compacta al estar trabajando con un documento */
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2">
          <div className="flex items-center gap-2 text-xs">
            <Link to="/" className="inline-flex items-center gap-1 text-graphite hover:text-ink">
              <ArrowLeft className="size-3.5" aria-hidden />
              Instrumentos
            </Link>
            <span className="text-line">/</span>
            <span className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
              <Icon className="size-4 text-signal-deep" aria-hidden />
              {tool.name}
            </span>
            <OnDeviceBadge processing={tool.processing} size="sm" />
          </div>
        </div>
      )}

      <div className={hasActiveDoc ? 'mt-2 lg:flex-1 lg:min-h-0 lg:overflow-hidden' : 'mt-8'}>
        {ToolEngine ? (
          <ErrorBoundary label={tool.name} resetKey={tool.slug}>
            <Suspense fallback={<LoadingFacts label={`Preparando «${tool.name}»…`} />}>
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
