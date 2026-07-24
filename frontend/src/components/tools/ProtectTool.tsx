import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Lock, Check } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { downloadBytes, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { toast } from '../../lib/notify/toast';
import type { PdfPermissions } from '../../lib/pdf/secureWasm';
import type { ToolEngineProps } from './types';

const PERMS: { key: keyof PdfPermissions; label: string }[] = [
  { key: 'print', label: 'Imprimir' },
  { key: 'copy', label: 'Copiar texto' },
  { key: 'modify', label: 'Editar' },
  { key: 'annotate', label: 'Anotar' },
];

export function ProtectTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [perms, setPerms] = useState<PdfPermissions>({ print: true, copy: true, modify: true, annotate: true });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  useEffect(() => {
    const h = takeHandoff();
    if (h) { setFileName(stripExtension(h.filename)); setSize(h.bytes.length); setBytes(h.bytes); }
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    setDone(false);
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
    if (pwd.length < 1) return setError('Escribe una contraseña.');
    if (pwd !== pwd2) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      const restricted = PERMS.some((p) => !perms[p.key]);
      const { protectPdf } = await import('../../lib/pdf/secureWasm');
      const out = await protectPdf(bytes, pwd, undefined, restricted ? perms : undefined);
      downloadBytes(out, `${fileName}-protegido.pdf`);
      setDone(true);
      toast('PDF protegido con contraseña y descargado.', 'success');
    } catch {
      setError('No se pudo proteger el PDF.');
    } finally {
      setBusy(false);
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para cifrarlo con contraseña (AES-256). Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><Lock className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.pdf</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); setDone(false); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-mono text-xs text-graphite">Contraseña</span>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal" autoComplete="new-password" />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs text-graphite">Repite la contraseña</span>
          <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal" autoComplete="new-password" />
        </label>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Permisos (al abrir con la contraseña)</p>
        <div className="flex flex-wrap gap-2">
          {PERMS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setPerms((p) => ({ ...p, [key]: !p[key] }))} className={`inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border px-3 py-1.5 text-sm ${perms[key] ? 'border-signal bg-signal/5 text-signal-deep' : 'border-line text-graphite'}`}>
              <span className={`grid size-4 place-items-center rounded border ${perms[key] ? 'border-signal bg-signal-deep text-paper' : 'border-line'}`}>{perms[key] && <Check className="size-3" />}</span>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-graphite">Desmarca lo que quieras impedir. El cifrado es AES-256 y ocurre en tu navegador.</p>
      </div>

      {done && <p className="rounded-[var(--radius-instrument)] border border-signal/40 bg-signal/5 px-4 py-2 text-sm text-signal-deep">✓ PDF protegido y descargado.</p>}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy}><Lock className="size-4" aria-hidden /> Proteger y descargar</Button>
      </div>
    </div>
  );
}
