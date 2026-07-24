import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Hash } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { ColorControl, LabeledSlider, Segmented } from '../editor-kit/controls';
import { LivePreview } from '../editor-kit/LivePreview';
import { PositionGrid } from '../editor-kit/PositionGrid';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { addPageNumbers, formatNumber } from '../../lib/pdf/pageNumbers';
import { FONTS, type FontFamily } from '../../lib/pdf/annotations';
import type { Position } from '../../lib/pdf/layout';
import type { ToolEngineProps, ToolResult } from './types';

const FORMATS = ['{n}', '{n} / {total}', 'Página {n}', 'Pág. {n}/{total}', '- {n} -'];

const FLEX: Record<Position, { justify: string; align: string }> = {
  'top-left': { justify: 'flex-start', align: 'flex-start' },
  'top-center': { justify: 'center', align: 'flex-start' },
  'top-right': { justify: 'flex-end', align: 'flex-start' },
  'center-left': { justify: 'flex-start', align: 'center' },
  center: { justify: 'center', align: 'center' },
  'center-right': { justify: 'flex-end', align: 'center' },
  'bottom-left': { justify: 'flex-start', align: 'flex-end' },
  'bottom-center': { justify: 'center', align: 'flex-end' },
  'bottom-right': { justify: 'flex-end', align: 'flex-end' },
};

export function PageNumbersTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [position, setPosition] = useState<Position>('bottom-center');
  const [template, setTemplate] = useState('{n} / {total}');
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [color, setColor] = useState('#14161b');
  const [font, setFont] = useState<FontFamily>('helvetica');
  const [skipText, setSkipText] = useState('');
  const [countSkipped, setCountSkipped] = useState(true);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

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

  function parseSkip(): number[] {
    return skipText.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  }

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const out = await addPageNumbers(bytes, { position, template: template || '{n}', startAt, fontSize, color, font, margin: 28, skip: parseSkip(), countSkipped });
      setResult({ bytes: out, filename: `${fileName}-numerado.pdf` });
    } catch {
      setError('No se pudieron añadir los números de página.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="page-numbers" onReset={() => { setBytes(null); setResult(null); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para numerar sus páginas." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const overlay = (dims: { width: number; pageCount: number }) => {
    const scale = dims.width / 595;
    const sample = formatNumber(template || '{n}', startAt, dims.pageCount);
    return (
      <div className="flex h-full w-full p-3" style={{ justifyContent: FLEX[position].justify, alignItems: FLEX[position].align }}>
        <span style={{ color, fontSize: fontSize * scale, fontFamily: FONTS[font].css }}>{sample}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        {error && <ErrorAlert message={error} />}

        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="mb-1.5 text-xs font-medium text-graphite">Posición</p>
            <PositionGrid value={position} onChange={setPosition} />
          </div>
          <div className="flex-1 space-y-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-graphite">Formato</span>
              <input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="{n} / {total}" className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-signal focus:outline-none" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button key={f} type="button" onClick={() => setTemplate(f)} className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${template === f ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:border-signal/40'}`}>{f}</button>
              ))}
            </div>
            <p className="font-mono text-[11px] text-graphite">Variables: {'{n}'} número · {'{total}'} total · {'{N}'} con ceros</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="mb-1.5 text-xs font-medium text-graphite">Color</p><ColorControl value={color} onChange={(c) => setColor(c!)} /></div>
          <div><p className="mb-1.5 text-xs font-medium text-graphite">Tipografía</p><Segmented value={font} onChange={setFont} options={(Object.keys(FONTS) as FontFamily[]).map((f) => ({ value: f, label: FONTS[f].label }))} /></div>
        </div>
        <LabeledSlider label="Tamaño" value={fontSize} min={8} max={24} unit="pt" onChange={setFontSize} />

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-graphite">Empezar en</span>
            <input type="number" min={0} value={startAt} onChange={(e) => setStartAt(Number(e.target.value))} className="w-24 rounded-md border border-line bg-paper px-3 py-2 font-mono text-ink focus:border-signal focus:outline-none" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="text-graphite">Omitir páginas</span>
            <input value={skipText} onChange={(e) => setSkipText(e.target.value)} placeholder="1, 2" className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-signal focus:outline-none" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={countSkipped} onChange={(e) => setCountSkipped(e.target.checked)} className="size-4 accent-signal" /> Las páginas omitidas cuentan en la secuencia</label>

        <div className="flex items-center gap-3">
          <Button onClick={run} loading={busy}><Hash className="size-4" aria-hidden /> Numerar páginas</Button>
          <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">Cambiar archivo</button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <p className="mb-2 text-xs font-medium text-graphite">Vista previa</p>
        <LivePreview bytes={bytes} width={300} overlay={overlay} />
      </div>
    </div>
  );
}
