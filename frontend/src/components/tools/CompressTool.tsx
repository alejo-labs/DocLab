import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Info, Minimize2, ArrowRight } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { compressPdf, type CompressionLevel, type CompressStats } from '../../lib/pdf/compress';
import { downloadBytes, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import type { ToolEngineProps } from './types';

const LEVELS: { value: CompressionLevel; label: string; hint: string }[] = [
  { value: 'screen', label: 'Máxima', hint: 'todo a imagen · sin texto' },
  { value: 'ebook', label: 'Equilibrada', hint: 'conserva el texto' },
  { value: 'printer', label: 'Alta calidad', hint: 'conserva el texto' },
];

export function CompressTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [originalSize, setOriginalSize] = useState(0);
  const [level, setLevel] = useState<CompressionLevel>('ebook');
  const [result, setResult] = useState<{ bytes: Uint8Array; size: number; stats: CompressStats } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  // Encadenado desde otra herramienta.
  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) {
      setFileName(stripExtension(handoff.filename));
      setOriginalSize(handoff.bytes.length);
      setBytes(handoff.bytes);
    }
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    setResult(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) {
      setError(`"${file.name}" no es un PDF válido.`);
      return;
    }
    setFileName(stripExtension(file.name));
    setOriginalSize(file.size);
    setBytes(data);
  }

  async function run() {
    if (!bytes) return;
    setError(null);
    setResult(null);
    setBusy(true);
    setProgress({ done: 0, total: 0 });
    try {
      const compressed = await compressPdf(bytes, level, (done, total) => setProgress({ done, total }));
      setResult({ bytes: compressed.bytes, size: compressed.bytes.byteLength, stats: compressed.stats });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comprimir el PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone
          accept="application/pdf"
          hint="Sube un PDF para reducir su peso. Ideal para documentos escaneados o con muchas imágenes."
          onFiles={onFile}
        />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const reduction = result ? Math.max(0, Math.round((1 - result.size / originalSize) * 100)) : 0;

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex items-start gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-4 py-3 text-sm text-graphite">
        <Info className="mt-0.5 size-4 shrink-0 text-signal-deep" aria-hidden />
        <span>
          {level === 'screen' ? (
            <><strong>Máxima</strong>: convierte todas las páginas a imagen para la mayor reducción posible
            (el <strong>texto deja de ser seleccionable</strong>). Ideal para enviar o archivar.</>
          ) : (
            <>Las páginas de <strong>texto se conservan intactas</strong> (seleccionables) y solo se
            recomprimen/reducen las <strong>imágenes</strong> embebidas y los escaneados.</>
          )}{' '}Todo ocurre íntegro en tu navegador.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-graphite">Nivel:</span>
        {LEVELS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLevel(option.value)}
            className={`flex flex-col items-start rounded-[var(--radius-instrument)] border px-3 py-1.5 text-left transition-colors ${
              level === option.value
                ? 'border-signal bg-signal/10'
                : 'border-line hover:border-signal/40'
            }`}
          >
            <span className={`text-sm font-medium ${level === option.value ? 'text-signal-deep' : 'text-ink'}`}>
              {option.label}
            </span>
            <span className="font-mono text-[10px] text-graphite">{option.hint}</span>
          </button>
        ))}
      </div>

      {progress && progress.total > 0 && (
        <ProgressBar
          value={(progress.done / progress.total) * 100}
          label={`Comprimiendo página ${progress.done} de ${progress.total}…`}
        />
      )}

      {result && (
        <div className="space-y-2 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-graphite">{formatBytes(originalSize)}</span>
              <ArrowRight className="size-4 text-signal-deep" aria-hidden />
              <span className="font-medium text-ink">{formatBytes(result.size)}</span>
            </div>
            <span className="rounded-full bg-signal/15 px-2.5 py-0.5 font-mono text-xs text-signal-deep">
              {reduction > 0 ? `−${reduction}%` : 'sin cambios'}
            </span>
            <Button
              variant="ghost"
              onClick={() => downloadBytes(result.bytes, `${fileName}-comprimido.pdf`)}
              className="ml-auto"
            >
              Descargar
            </Button>
          </div>
          <p className="font-mono text-xs text-graphite">
            {(() => {
              const s = result.stats;
              const parts: string[] = [];
              if (s.rasterized > 0) parts.push(`${s.rasterized} pág${s.rasterized > 1 ? 's' : ''} escaneada(s) recomprimida(s)`);
              if (s.imagesOptimized > 0) parts.push(`${s.imagesOptimized} imagen${s.imagesOptimized > 1 ? 'es' : ''} optimizada(s)`);
              if (s.kept > 0) parts.push(`${s.kept} pág${s.kept > 1 ? 's' : ''} de texto con el texto intacto`);
              if (parts.length && (s.rasterized > 0 || s.imagesOptimized > 0)) return `${parts.join(' · ')}.`;
              return reduction > 0
                ? `Optimizado conservando el texto de las ${s.kept} páginas.`
                : 'Este PDF es de texto/vectorial sin imágenes que recomprimir, así que ya es ligero.';
            })()}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy}>
          <Minimize2 className="size-4" aria-hidden />
          Comprimir
        </Button>
        <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">
          Cambiar archivo
        </button>
      </div>
    </div>
  );
}
