import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Lock } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { downloadBytes, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { useReportActiveDoc } from '../../lib/activeDocContext';
import { toast } from '../../lib/notify/toast';
import { DocumentPreviewInspector } from '../DocumentPreviewInspector';
import type { PdfPermissions } from '../../lib/pdf/secureWasm';
import type { ToolEngineProps } from './types';

const PERMS: { key: keyof PdfPermissions; label: string }[] = [
  { key: 'print', label: 'Imprimir' },
  { key: 'copy', label: 'Copiar texto/imágenes' },
  { key: 'modify', label: 'Modificar contenido' },
  { key: 'annotate', label: 'Añadir notas/comentarios' },
];

export function ProtectTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [perms, setPerms] = useState<PdfPermissions>({ print: true, copy: false, modify: false, annotate: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);
  useReportActiveDoc(!!bytes);

  useEffect(() => {
    const h = takeHandoff();
    if (h) {
      setFileName(stripExtension(h.filename));
      setBytes(h.bytes);
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
  }

  async function run() {
    if (!bytes) return;
    if (!pwd) return setError('Escribe una contraseña.');
    if (pwd !== pwd2) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      const { protectPdf } = await import('../../lib/pdf/secureWasm');
      const out = await protectPdf(bytes, pwd, undefined, restricted ? perms : undefined);
      downloadBytes(out, `${fileName}-protegido.pdf`);
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
    <div className="flex flex-col gap-6 lg:h-full lg:flex-row lg:items-stretch lg:overflow-hidden">
      <div className="min-w-0 flex-1 space-y-4 lg:h-full lg:overflow-y-auto lg:pr-3">
        {error && <ErrorAlert message={error} />}

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
              <button key={key} type="button" onClick={() => { setRestricted(true); setPerms((p) => ({ ...p, [key]: !p[key] })); }} className={`inline-flex items-center gap-1.5 rounded-[var(--radius-instrument)] border px-3 py-1.5 text-sm ${perms[key] ? 'border-signal bg-signal/5 text-signal-deep' : 'border-line text-graphite'}`}>
                <input type="checkbox" checked={perms[key]} onChange={() => {}} className="size-3.5 accent-[var(--color-signal-deep)]" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={run} loading={busy}><Lock className="size-4" aria-hidden /> Proteger y descargar</Button>
      </div>
      <DocumentPreviewInspector bytes={bytes} fileName={fileName} onClear={() => setBytes(null)} />
    </div>
  );
}
