import { Search, Sparkles, X, Loader2 } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onAskAi: () => void;
  aiAvailable: boolean;
  aiBusy: boolean;
}

export function SearchBar({ query, onQueryChange, onAskAi, aiAvailable, aiBusy }: SearchBarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-graphite" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aiAvailable && onAskAi()}
          placeholder="¿Qué quieres hacer? Ej: unir varios PDF, girar páginas…"
          aria-label="Buscar herramienta"
          className="w-full rounded-[var(--radius-instrument)] border border-line bg-paper-raised py-3.5 pl-12 pr-10 text-ink placeholder:text-graphite focus:border-signal focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-graphite hover:text-ink"
            aria-label="Limpiar"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {aiAvailable && (
        <button
          type="button"
          onClick={onAskAi}
          disabled={aiBusy || query.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/10 px-4 py-3.5 font-medium text-signal-deep transition-colors hover:bg-signal/15 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          Preguntar a la IA
        </button>
      )}
    </div>
  );
}
