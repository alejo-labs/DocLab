import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Grid2x2 } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import type { NupPerSheet } from '../../lib/pdf/nup';
import type { ToolEngineProps, ToolResult } from './types';

const CHOICES: { value: NupPerSheet; label: string; grid: string }[] = [
  { value: 2, label: '2 por hoja', grid: '2×1 (horizontal)' },
  { value: 4, label: '4 por hoja', grid: '2×2' },
  { value: 6, label: '6 por hoja', grid: '2×3' },
  { value: 9, label: '9 por hoja', grid: '3×3' },
];

export function NupTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [perSheet, setPerSheet] = useState<NupPerSheet>(2);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);
  useReportActiveDoc(!!bytes);

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
      const { nUpPdf } = await import('../../lib/pdf/nup');
      const out = await nUpPdf(bytes, { perSheet });
      setResult({ bytes: out, filename: `${fileName}-${perSheet}por-hoja.pdf` });
    } catch {
      setError('No se pudo componer el PDF. ¿Está protegido o dañado?');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="nup" onReset={() => { setResult(null); setBytes(null); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para imprimir varias páginas en cada hoja y ahorrar papel. Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><Grid2x2 className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.pdf</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Páginas por hoja</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHOICES.map((c) => (
            <button key={c.value} type="button" onClick={() => setPerSheet(c.value)} className={`rounded-[var(--radius-instrument)] border p-3 text-center transition-colors ${perSheet === c.value ? 'border-signal bg-signal/5' : 'border-line bg-paper-raised hover:border-signal/40'}`}>
              <p className={`font-display font-600 ${perSheet === c.value ? 'text-signal-deep' : 'text-ink'}`}>{c.label}</p>
              <p className="mt-0.5 font-mono text-[10px] text-graphite">{c.grid}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={run} loading={busy}><Grid2x2 className="size-4" aria-hidden /> Componer y descargar</Button>
      </div>
    </div>
  );
}
