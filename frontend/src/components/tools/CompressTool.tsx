import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Info, Minimize2 } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { compressPdf, type CompressionLevel } from '../../lib/pdf/compress';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import { DocumentPreviewInspector } from '../DocumentPreviewInspector';
import type { ToolEngineProps, ToolResult } from './types';

const LEVELS: { value: CompressionLevel; label: string; hint: string }[] = [
  { value: 'screen', label: 'Máxima', hint: 'todo a imagen · sin texto' },
  { value: 'ebook', label: 'Equilibrada', hint: 'conserva el texto' },
  { value: 'printer', label: 'Alta calidad', hint: 'conserva el texto' },
];

export function CompressTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [level, setLevel] = useState<CompressionLevel>('ebook');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);
  useReportActiveDoc(!!bytes);

  // Encadenado desde otra herramienta.
  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) {
      setFileName(stripExtension(handoff.filename));
      setBytes(handoff.bytes);
    }
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    setBytes(data);
    setResult(null);
  }

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await compressPdf(bytes, level, (done, total) => setProgress({ done, total }));
      setResult({ bytes: res.bytes, filename: `${fileName}-comprimido.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo comprimir el PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="compress" onReset={() => { setBytes(null); setResult(null); }} />;

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

  return (
    <div className="flex flex-col gap-6 lg:h-full lg:flex-row lg:items-stretch lg:overflow-hidden">
      {/* Opciones de compresión */}
      <div className="min-w-0 flex-1 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-3">
        {error && <ErrorAlert message={error} />}

        <div className="flex items-start gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-4 py-3 text-sm text-graphite">
          <Info className="mt-0.5 size-4 shrink-0 text-signal-deep" aria-hidden />
          <span>
            {level === 'screen' ? (
              <>La opción <strong>Máxima</strong> convierte todas las páginas a imagen para la mayor reducción
              posible (el <strong>texto deja de ser seleccionable</strong>). Ideal para enviar o archivar.</>
            ) : (
              <>Las páginas de <strong>texto se conservan intactas</strong> (seleccionables) y solo se
              recomprimen y reducen las <strong>imágenes</strong> embebidas y los escaneados.</>
            )}{' '}Todo ocurre íntegro en tu navegador.
          </span>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-signal-deep">Nivel de compresión</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLevel(option.value)}
                className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-all ${
                  level === option.value
                    ? 'border-signal-deep bg-signal/15 text-signal-deep font-semibold shadow-xs ring-1 ring-signal/30'
                    : 'border-line bg-paper-raised text-ink/80 hover:border-signal/50 hover:bg-paper'
                }`}
              >
                <span className="font-medium text-sm text-ink">{option.label}</span>
                <span className="font-mono text-[11px] text-graphite">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {progress && (
          <div className="space-y-2">
            <ProgressBar value={(progress.done / Math.max(1, progress.total)) * 100} label={`Comprimiendo imágenes (${progress.done}/${progress.total})…`} />
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={run} loading={busy} className="font-semibold shadow-sm">
            <Minimize2 className="size-4" aria-hidden /> Comprimir PDF
          </Button>
          <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">
            Cambiar archivo
          </button>
        </div>
      </div>

      {/* Tarjeta de vista previa del documento */}
      <DocumentPreviewInspector bytes={bytes} fileName={fileName} onClear={() => setBytes(null)} />
    </div>
  );
}
