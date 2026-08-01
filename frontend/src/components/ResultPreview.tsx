import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, RotateCcw, ArrowRight, Loader2 } from 'lucide-react';
import { TOOLS, type EngineId } from '../lib/tools';
import { createPdfLoadingTask, renderPageThumbnail } from '../lib/pdf/pdfjs';
import { downloadBytes } from '../lib/pdf/download';
import { formatBytes } from '../lib/files';
import { setHandoff } from '../lib/handoff';
import { toast } from '../lib/notify/toast';
import { Button } from './ui';
import type { ToolResult } from './tools/types';

interface ResultPreviewProps {
  result: ToolResult;
  /** Motor actual: para no sugerir encadenar consigo mismo. */
  currentEngine: EngineId;
  /** Reinicia la herramienta para procesar otro archivo. */
  onReset: () => void;
}

// Herramientas que operan sobre un PDF y tienen sentido como "siguiente paso".
const NEXT_ACTION_SLUGS = ['organizar-pdf', 'comprimir-pdf', 'dividir-pdf', 'rotar-pdf'];

export function ResultPreview({ result, currentEngine, onReset }: ResultPreviewProps) {
  const navigate = useNavigate();
  const [thumb, setThumb] = useState<string | null>(null);

  // Aviso de éxito (toast global).
  useEffect(() => {
    toast(`¡Listo! · ${formatBytes(result.bytes.length)}`, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = createPdfLoadingTask(result.bytes);
    (async () => {
      try {
        const pdf = await task.promise;
        const page = await renderPageThumbnail(pdf, 1, 320);
        if (!cancelled) setThumb(page.dataUrl);
        await task.destroy();
      } catch {
        if (!cancelled) setThumb(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result.bytes]);

  const nextActions = TOOLS.filter(
    (tool) => NEXT_ACTION_SLUGS.includes(tool.slug) && tool.engineId !== currentEngine,
  ).slice(0, 3);

  function chainTo(slug: string) {
    setHandoff({ bytes: result.bytes, filename: result.filename });
    navigate(`/h/${slug}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-5 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 p-5 sm:flex-row sm:items-center">
        {/* Vista previa de la primera página */}
        <div className="grid aspect-[3/4] w-32 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white">
          {thumb ? (
            <img src={thumb} alt="Vista previa del resultado" className="h-full w-full object-contain" />
          ) : (
            <Loader2 className="size-5 animate-spin text-graphite" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-display text-lg font-600 text-ink">
            <CheckCircle2 className="size-5 text-signal-deep" aria-hidden />
            ¡Listo!
          </p>
          <p className="mt-1 truncate font-mono text-sm text-graphite">{result.filename}</p>
          <p className="font-mono text-xs text-graphite">{formatBytes(result.bytes.length)}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => downloadBytes(result.bytes, result.filename)}>
              <Download className="size-4" aria-hidden />
              Descargar
            </Button>
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw className="size-4" aria-hidden />
              Otro archivo
            </Button>
          </div>
        </div>
      </div>

      {nextActions.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">
            Continuar con este resultado
          </p>
          <div className="flex flex-wrap gap-2">
            {nextActions.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => chainTo(tool.slug)}
                  className="group inline-flex items-center gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-3 py-2 text-sm text-ink transition-colors hover:border-signal/50 hover:text-signal-deep"
                >
                  <Icon className="size-4" aria-hidden />
                  {tool.name}
                  <ArrowRight className="size-3.5 text-graphite transition-colors group-hover:text-signal-deep" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
