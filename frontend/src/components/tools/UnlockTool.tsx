import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { LockOpen } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import type { ToolEngineProps, ToolResult } from './types';

export function UnlockTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [pwd, setPwd] = useState('');
  const [result, setResult] = useState<ToolResult | null>(null);
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
      const { unlockPdf } = await import('../../lib/pdf/secureWasm');
      const out = await unlockPdf(bytes, pwd);
      setResult({ bytes: out, filename: `${fileName}-desbloqueado.pdf` });
    } catch {
      setError('No se pudo desbloquear. ¿La contraseña es correcta?');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="unlock" onReset={() => { setResult(null); setBytes(null); setPwd(''); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF protegido para quitarle la contraseña (necesitas conocerla). Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><LockOpen className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.pdf</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block font-mono text-xs text-graphite">Contraseña del PDF</span>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal" autoComplete="off" />
      </label>

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy}><LockOpen className="size-4" aria-hidden /> Desbloquear</Button>
      </div>
    </div>
  );
}
