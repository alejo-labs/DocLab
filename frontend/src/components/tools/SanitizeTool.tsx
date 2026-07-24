import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { ShieldCheck, Code2, Paperclip, Tags, Check } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { downloadBytes, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import type { SanitizeOptions, SanitizeReport } from '../../lib/pdf/secure';
import type { ToolEngineProps } from './types';

const OPTS: { key: keyof SanitizeOptions; icon: typeof Code2; title: string; desc: string }[] = [
  { key: 'javascript', icon: Code2, title: 'JavaScript embebido', desc: 'Scripts y acciones automáticas (OpenAction, /AA, XFA).' },
  { key: 'embeddedFiles', icon: Paperclip, title: 'Archivos adjuntos', desc: 'Ficheros incrustados dentro del PDF.' },
  { key: 'metadata', icon: Tags, title: 'Metadatos', desc: 'Título, autor, software y rastro XMP.' },
];

export function SanitizeTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [options, setOptions] = useState<SanitizeOptions>({ javascript: true, embeddedFiles: true, metadata: true });
  const [result, setResult] = useState<{ bytes: Uint8Array; size: number; report: SanitizeReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError(null);
    try {
      const { sanitizePdf } = await import('../../lib/pdf/secure');
      const out = await sanitizePdf(bytes, options);
      setResult({ bytes: out.bytes, size: out.bytes.byteLength, report: out.report });
    } catch {
      setError('No se pudo sanear el PDF. ¿Está protegido con contraseña?');
    } finally {
      setBusy(false);
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para eliminar scripts, adjuntos y metadatos. Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const toggle = (k: keyof SanitizeOptions) => setOptions((o) => ({ ...o, [k]: !o[k] }));
  const any = options.javascript || options.embeddedFiles || options.metadata;

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><ShieldCheck className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.pdf</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setResult(null); setError(null); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Qué eliminar</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTS.map(({ key, icon: Icon, title, desc }) => (
            <button key={key} type="button" onClick={() => toggle(key)} className={`rounded-[var(--radius-instrument)] border p-3 text-left transition-colors ${options[key] ? 'border-signal bg-signal/5' : 'border-line bg-paper-raised hover:border-signal/40'}`}>
              <span className="flex items-center justify-between">
                <Icon className={`size-4 ${options[key] ? 'text-signal-deep' : 'text-graphite'}`} aria-hidden />
                <span className={`grid size-4 place-items-center rounded border ${options[key] ? 'border-signal bg-signal-deep text-paper' : 'border-line'}`}>{options[key] && <Check className="size-3" />}</span>
              </span>
              <p className="mt-1.5 font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-xs text-graphite">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="space-y-1.5 rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
          <p className="font-medium text-ink">PDF saneado · {formatBytes(result.size)}</p>
          <ul className="space-y-0.5 font-mono text-xs text-graphite">
            <li>{result.report.javascript ? '✓ JavaScript eliminado' : '· Sin JavaScript que eliminar'}</li>
            <li>{result.report.embeddedFiles > 0 ? `✓ ${result.report.embeddedFiles} adjunto(s) eliminado(s)` : '· Sin adjuntos que eliminar'}</li>
            <li>{result.report.metadata ? '✓ Metadatos eliminados' : '· Metadatos sin tocar'}</li>
          </ul>
          <Button variant="ghost" onClick={() => downloadBytes(result.bytes, `${fileName}-saneado.pdf`)} className="mt-1">Descargar</Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy} disabled={!any}><ShieldCheck className="size-4" aria-hidden /> Sanear PDF</Button>
      </div>
    </div>
  );
}
