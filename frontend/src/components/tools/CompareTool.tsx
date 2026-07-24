import { useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { GitCompare, FileText } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import type { PageComparison } from '../../lib/pdf/compare';
import type { ToolEngineProps } from './types';

interface Slot { bytes: Uint8Array; name: string }

export function CompareTool(_props: ToolEngineProps) {
  const [a, setA] = useState<Slot | null>(null);
  const [b, setB] = useState<Slot | null>(null);
  const [diff, setDiff] = useState<PageComparison[] | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  async function pick(which: 'a' | 'b', files: File[]) {
    setError(null);
    setDiff(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    const slot = { bytes: data, name: stripExtension(file.name) };
    if (which === 'a') setA(slot); else setB(slot);
  }

  async function run() {
    if (!a || !b) return;
    setBusy(true);
    setError(null);
    try {
      const { comparePdfs } = await import('../../lib/pdf/compare');
      setDiff(await comparePdfs(a.bytes, b.bytes));
    } catch {
      setError('No se pudieron comparar los PDF.');
    } finally {
      setBusy(false);
    }
  }

  const changedCount = diff?.filter((p) => p.changed).length ?? 0;
  const shown = diff?.filter((p) => !onlyChanged || p.changed) ?? [];

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {(['a', 'b'] as const).map((which) => {
          const slot = which === 'a' ? a : b;
          return (
            <div key={which}>
              <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">{which === 'a' ? 'Original (A)' : 'Modificado (B)'}</p>
              {slot ? (
                <div className="flex items-center justify-between gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-signal-deep" /><span className="truncate">{slot.name}.pdf</span></span>
                  <button type="button" onClick={() => (which === 'a' ? setA(null) : setB(null))} className="text-graphite hover:text-ink">Cambiar</button>
                </div>
              ) : (
                <FileDropzone accept="application/pdf" hint={`Sube el PDF ${which.toUpperCase()}.`} onFiles={(f) => pick(which, f)} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy} disabled={!a || !b}><GitCompare className="size-4" aria-hidden /> Comparar</Button>
        {diff && <span className="font-mono text-xs text-graphite">{changedCount === 0 ? 'Sin diferencias de texto.' : `${changedCount} página(s) con cambios.`}</span>}
      </div>

      {diff && (
        <>
          <label className="inline-flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="size-4 accent-[var(--color-signal-deep)]" /> Solo páginas con cambios
          </label>
          <div className="space-y-4">
            {shown.map((page) => (
              <div key={page.page} className="rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4">
                <p className="mb-2 font-mono text-xs text-graphite">Página {page.page}{!page.changed && ' · sin cambios'}</p>
                <div className="space-y-2">
                  {page.paragraphs.map((para, pi) => (
                    <p key={pi} className={`text-sm leading-relaxed ${para.changed ? '' : 'text-graphite'}`}>
                      {para.ops.map((op, i) => (
                        <span key={i} className={op.type === 'add' ? 'rounded bg-signal/15 text-signal-deep' : op.type === 'del' ? 'rounded bg-ember/15 text-ember line-through' : 'text-ink'}>
                          {op.text}{' '}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="text-sm text-graphite">No hay páginas que mostrar.</p>}
          </div>
        </>
      )}
    </div>
  );
}
