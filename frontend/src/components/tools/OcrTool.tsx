import { useEffect, useRef, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { ScanText, Download, Copy, Check, Loader2, X } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { downloadBytes, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { toast } from '../../lib/notify/toast';
import type { OcrLang } from '../../lib/pdf/ocr';
import type { ToolEngineProps } from './types';

const LANGS: { value: OcrLang; label: string }[] = [
  { value: 'spa+eng', label: 'Español + Inglés' },
  { value: 'spa', label: 'Español' },
  { value: 'eng', label: 'Inglés' },
];

export function OcrTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [lang, setLang] = useState<OcrLang>('spa+eng');
  const [progress, setProgress] = useState<{ page: number; total: number; ocr: number } | null>(null);
  const [phase, setPhase] = useState<'preparing' | 'recognizing'>('preparing');
  const [result, setResult] = useState<{ bytes: Uint8Array; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useReportProcessing(busy);

  useEffect(() => {
    const h = takeHandoff();
    if (h) { setFileName(stripExtension(h.filename)); setSize(h.bytes.length); setBytes(h.bytes); }
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    setResult(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    setSize(data.length);
    setBytes(data);
  }

  async function run() {
    if (!bytes) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    setError(null);
    setResult(null);
    setPhase('preparing');
    setProgress({ page: 0, total: 0, ocr: 0 });
    try {
      const { makeSearchablePdf } = await import('../../lib/pdf/makeSearchable');
      const out = await makeSearchablePdf(bytes, lang, {
        onProgress: (page, total, ocr) => setProgress({ page, total, ocr }),
        onPhase: setPhase,
        signal: ac.signal,
      });
      setResult(out);
      toast('OCR completado.', 'success');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') toast('OCR cancelado.', 'info');
      else setError('No se pudo aplicar OCR. ¿El PDF está protegido o dañado?');
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF escaneado para reconocer su texto (OCR) y hacerlo buscable. Todo en tu dispositivo, sin que el archivo salga." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><ScanText className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.pdf</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); setResult(null); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Idioma del documento</p>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button key={l.value} type="button" onClick={() => setLang(l.value)} className={`rounded-[var(--radius-instrument)] border px-3 py-1.5 text-sm ${lang === l.value ? 'border-signal bg-signal/5 text-signal-deep' : 'border-line text-graphite hover:text-ink'}`}>{l.label}</button>
          ))}
        </div>
      </div>

      {busy && (phase === 'preparing' || !progress?.total) ? (
        <div className="flex items-center gap-2.5 rounded-[var(--radius-instrument)] border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal-deep">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span>Preparando el motor de OCR… <span className="text-graphite">la primera vez descarga el modelo de idioma (unos MB) y puede tardar; luego queda en caché.</span></span>
        </div>
      ) : busy && progress ? (
        <ProgressBar
          value={progress.total ? ((progress.page - 1 + progress.ocr) / progress.total) * 100 : 0}
          label={`OCR de la página ${progress.page} de ${progress.total}… (${Math.round(progress.ocr * 100)}%). Puede tardar un poco.`}
        />
      ) : null}

      {result && (
        <div className="space-y-3 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium text-ink">✓ Texto reconocido</p>
            <Button variant="ghost" onClick={() => downloadBytes(result.bytes, `${fileName}-buscable.pdf`)} className="ml-auto"><Download className="size-4" /> PDF buscable</Button>
            <button type="button" onClick={() => { downloadBytes(new TextEncoder().encode(result.text), `${fileName}.txt`, 'text/plain'); }} className="inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border border-line px-3 py-2 text-sm text-ink hover:border-signal/50"><Download className="size-4" /> .txt</button>
            <button type="button" onClick={() => { navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border border-line px-3 py-2 text-sm text-ink hover:border-signal/50">{copied ? <Check className="size-4 text-signal-deep" /> : <Copy className="size-4" />} Copiar</button>
          </div>
          <textarea readOnly value={result.text} rows={10} className="w-full resize-y rounded border border-line bg-paper p-2 font-mono text-xs text-ink outline-none" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy}><ScanText className="size-4" aria-hidden /> Reconocer texto (OCR)</Button>
        {busy && (
          <Button variant="ghost" onClick={() => abortRef.current?.abort()}><X className="size-4" aria-hidden /> Cancelar</Button>
        )}
      </div>
    </div>
  );
}
