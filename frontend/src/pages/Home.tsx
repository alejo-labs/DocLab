import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WifiOff, Cpu, Trash2, Sparkles, SearchX, ArrowRight } from 'lucide-react';
import { TOOLS, getToolsByCategory } from '../lib/tools';
import { CATEGORIES } from '../lib/categories';
import { searchTools } from '../lib/search';
import { aiSearch, isAiSearchAvailable, type AiSearchResult } from '../lib/aiSearch';
import { ToolCard } from '../components/ToolCard';
import { OnDeviceBadge } from '../components/OnDeviceBadge';
import { SearchBar } from '../components/SearchBar';
import { CategoryChips, type CategoryFilter } from '../components/CategoryChips';
import { ErrorAlert } from '../components/ui';
import { usePageMeta } from '../lib/usePageMeta';

export function Home() {
  usePageMeta(
    'DocLab · Herramientas de PDF privadas, en tu navegador',
    'Une, comprime, edita, cifra y convierte PDF gratis, directamente en tu navegador. Tus archivos no salen de tu dispositivo: sin subidas, sin cuentas y sin rastreo.',
  );
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiResult, setAiResult] = useState<AiSearchResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    isAiSearchAvailable().then(setAiAvailable);
  }, []);

  const results = useMemo(() => {
    let list = query.trim() ? searchTools(query) : [...TOOLS];
    if (category !== 'all') list = list.filter((tool) => tool.category === category);
    return list;
  }, [query, category]);

  const isFiltering = query.trim().length > 0 || category !== 'all';

  function changeQuery(value: string) {
    setQuery(value);
    setAiResult(null);
    setAiError(null);
  }

  async function askAi() {
    if (!query.trim()) return;
    setAiBusy(true);
    setAiError(null);
    setAiResult(null);
    try {
      setAiResult(await aiSearch(query));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'No se pudo consultar la IA.');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <>
      {/* ── Hero: la tesis. La privacidad no es una feature, es el producto. ── */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)',
          }}
        />
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-deep">Soberanía del dato</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-700 leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Edita y convierte tus PDF <span className="text-signal-deep">sin salir de tu navegador</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-graphite">
            Un banco de instrumentos para documentos. Busca lo que necesitas o pregúntale a la IA.
          </p>

          {/* Buscador */}
          <div className="mt-7 max-w-2xl">
            <SearchBar
              query={query}
              onQueryChange={changeQuery}
              onAskAi={askAi}
              aiAvailable={aiAvailable}
              aiBusy={aiBusy}
            />
            <div className="mt-3">
              <OnDeviceBadge processing="on-device" size="md" />
            </div>
          </div>

          {/* Descubrir la documentación */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link to="/como-funciona" className="inline-flex items-center gap-1.5 font-medium text-signal-deep transition-colors hover:text-ink">
              Cómo funciona <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <Link to="/seguridad" className="text-graphite transition-colors hover:text-ink">Seguridad</Link>
            <Link to="/sobre" className="text-graphite transition-colors hover:text-ink">Sobre el proyecto</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        {/* Panel de respuesta IA */}
        {aiError && (
          <div className="mb-6">
            <ErrorAlert message={aiError} />
          </div>
        )}
        {aiResult && (
          <div className="mb-8 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 p-5">
            <p className="flex items-start gap-2 text-ink">
              <Sparkles className="mt-1 size-4 shrink-0 text-signal-deep" aria-hidden />
              <span>{aiResult.answer || 'Esto es lo que encontré para ti:'}</span>
            </p>
            {aiResult.tools.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {aiResult.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-graphite">No encontré una herramienta para eso todavía.</p>
            )}
          </div>
        )}

        {/* Filtro por categoría */}
        <div className="mb-8">
          <CategoryChips active={category} onChange={setCategory} />
        </div>

        {/* Resultados */}
        {isFiltering ? (
          results.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="grid place-items-center rounded-[var(--radius-instrument)] border border-dashed border-line py-16 text-center">
              <SearchX className="size-8 text-graphite" aria-hidden />
              <p className="mt-3 font-display text-lg font-600 text-ink">Sin resultados</p>
              <p className="mt-1 text-sm text-graphite">
                Prueba con otra palabra{aiAvailable && ' o pregúntale a la IA'}.
              </p>
            </div>
          )
        ) : (
          <div className="space-y-12">
            {CATEGORIES.map((cat) => {
              const tools = getToolsByCategory(cat.id);
              if (tools.length === 0) return null;
              const Icon = cat.icon;
              return (
                <div key={cat.id}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-md border border-line bg-paper-raised text-signal-deep">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <h2 className="font-display text-lg font-600 tracking-tight text-ink">{cat.label}</h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Franja de confianza */}
      <section className="border-t border-line bg-paper-raised">
        <dl className="mx-auto grid max-w-7xl grid-cols-1 gap-px px-5 sm:grid-cols-3">
          {[
            { icon: WifiOff, k: '0 bytes', v: 'subidos en procesos locales' },
            { icon: Cpu, k: 'En tu equipo', v: 'el cómputo corre en tu navegador' },
            { icon: Trash2, k: 'Cero retención', v: 'nada se guarda, ni en cliente ni servidor' },
          ].map(({ icon: Icon, k, v }) => (
            <div key={k} className="flex flex-col gap-1 py-8">
              <Icon className="size-4 text-signal-deep" aria-hidden />
              <dt className="font-mono text-sm font-500 text-ink">{k}</dt>
              <dd className="text-xs text-graphite">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
