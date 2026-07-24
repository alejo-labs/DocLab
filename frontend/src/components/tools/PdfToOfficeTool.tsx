import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { FileText, FileSpreadsheet, Presentation, Download, Loader2, AlertTriangle, type LucideIcon } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension, downloadBlob } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { getPageCount } from '../../lib/pdf/pdfjs';
import { usePdfThumbnails } from '../../lib/pdf/usePdfThumbnails';
import { toast } from '../../lib/notify/toast';
import type { WordMode } from '../../lib/pdf/pdfToWord';
import type { ToolEngineProps } from './types';

type Fmt = 'docx' | 'pptx' | 'xlsx';
const META: Record<Fmt, { label: string; ext: string; icon: LucideIcon; note: string }> = {
  docx: { label: 'Word', ext: 'docx', icon: FileText, note: 'Párrafos, títulos, listas, tablas e imágenes con su maquetación.' },
  pptx: { label: 'PowerPoint', ext: 'pptx', icon: Presentation, note: 'Una diapositiva por página, con el texto editable por bloques.' },
  xlsx: { label: 'Excel', ext: 'xlsx', icon: FileSpreadsheet, note: 'Cada tabla detectada en su propia hoja (con y sin bordes).' },
};
const FORMATS: Fmt[] = ['docx', 'pptx', 'xlsx'];
/** A partir de aquí avisamos y ofrecemos limitar el rango (conversión 100% en el navegador). */
const LARGE_DOC = 50;
const clampPage = (n: number, max: number) => Math.max(1, Math.min(max, Math.floor(n) || 1));

export function PdfToOfficeTool({ preset }: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [pages, setPages] = useState(0);
  const [range, setRange] = useState<{ from: number; to: number }>({ from: 1, to: 0 });
  const [fmt, setFmt] = useState<Fmt>((preset?.office as Fmt) ?? 'docx');
  const [wordMode, setWordMode] = useState<WordMode>('faithful');
  const [ocr, setOcr] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  async function load(data: Uint8Array, name: string) {
    setFileName(stripExtension(name));
    setSize(data.length);
    setBytes(data);
    try {
      const count = await getPageCount(data);
      setPages(count);
      setRange({ from: 1, to: count });
    } catch {
      setPages(0);
      setRange({ from: 1, to: 0 });
    }
  }

  useEffect(() => {
    const h = takeHandoff();
    if (h) load(h.bytes, h.filename);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    await load(data, file.name);
  }

  async function run() {
    if (!bytes) return;
    const from = Math.max(1, Math.min(range.from, range.to || 1));
    const to = Math.max(from, range.to || pages || 1);
    const span = { from, to };
    const partial = pages > 0 && (from > 1 || to < pages);
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: to - from + 1 });
    const onProg = (done: number, total: number) => setProgress({ done, total });
    try {
      let blob: Blob;
      if (fmt === 'docx') { const { pdfToWord } = await import('../../lib/pdf/pdfToWord'); blob = await pdfToWord(bytes, onProg, span, wordMode, ocr); }
      else if (fmt === 'pptx') { const { pdfToPptx } = await import('../../lib/pdf/pdfToPptx'); blob = await pdfToPptx(bytes, onProg, span); }
      else { const { pdfToExcel } = await import('../../lib/pdf/pdfToExcel'); blob = await pdfToExcel(bytes, onProg, span); }
      const suffix = partial ? `-p${from}-${to}` : '';
      downloadBlob(blob, `${fileName}${suffix}.${META[fmt].ext}`);
      toast(`PDF convertido a ${META[fmt].label}${partial ? ` (páginas ${from}–${to})` : ''}.`, 'success');
    } catch {
      setError('No se pudo convertir el PDF. Si está protegido o es muy complejo, prueba otro.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para convertirlo a Word, PowerPoint o Excel. Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div>
          <p className="font-medium text-ink">{fileName}.pdf</p>
          <p className="font-mono text-xs text-graphite">{pages} página(s) · {formatBytes(size)}</p>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); }} className="text-graphite hover:text-ink">Cambiar PDF</button>
      </div>

      {pages > 1 && (
        <div className="space-y-2">
          {pages > LARGE_DOC && (
            <div className="flex items-start gap-2 rounded-[var(--radius-instrument)] border border-ember/40 bg-ember/5 px-4 py-3 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ember" aria-hidden />
              <span>Documento extenso (<strong>{pages} páginas</strong>). La conversión ocurre íntegra en tu navegador; convertir todo de una vez puede tardar o consumir mucha memoria. Puedes <strong>limitar el rango</strong> y convertir por tramos.</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs uppercase tracking-wide text-graphite">Rango de páginas</span>
            <input type="number" min={1} max={pages} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: clampPage(Number(e.target.value), pages) }))} className="w-20 rounded border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal" aria-label="Desde la página" />
            <span className="text-graphite">a</span>
            <input type="number" min={1} max={pages} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: clampPage(Number(e.target.value), pages) }))} className="w-20 rounded border border-line bg-paper px-2 py-1.5 outline-none focus:border-signal" aria-label="Hasta la página" />
            <span className="font-mono text-xs text-graphite">de {pages}</span>
            {(range.from > 1 || range.to < pages) && (
              <button type="button" onClick={() => setRange({ from: 1, to: pages })} className="text-xs text-signal-deep hover:underline">Todo</button>
            )}
          </div>
        </div>
      )}

      <PdfPreview bytes={bytes} />

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Convertir a</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMATS.map((f) => {
            const m = META[f];
            const Icon = m.icon;
            return (
              <button key={f} type="button" onClick={() => setFmt(f)} className={`rounded-[var(--radius-instrument)] border p-4 text-left transition-colors ${fmt === f ? 'border-signal bg-signal/5' : 'border-line bg-paper-raised hover:border-signal/50'}`}>
                <span className={`grid size-9 place-items-center rounded-[8px] border ${fmt === f ? 'border-signal/40 bg-signal/10 text-signal-deep' : 'border-line text-graphite'}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <p className="mt-2 font-display font-600 text-ink">{m.label}</p>
                <p className="mt-0.5 text-xs text-graphite">{m.note}</p>
              </button>
            );
          })}
        </div>
      </div>

      {fmt === 'docx' && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Modo de conversión a Word</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { v: 'faithful' as WordMode, title: 'Fiel a la maquetación', desc: 'Reconstruye tablas, columnas e imágenes. Mejor para facturas, informes con tablas.' },
              { v: 'clean' as WordMode, title: 'Texto limpio', desc: 'Flujo de texto robusto, sin forzar tablas. Mejor para documentos de solo texto o complejos.' },
            ]).map((o) => (
              <button key={o.v} type="button" onClick={() => setWordMode(o.v)} className={`rounded-[var(--radius-instrument)] border p-3 text-left transition-colors ${wordMode === o.v ? 'border-signal bg-signal/5' : 'border-line bg-paper-raised hover:border-signal/50'}`}>
                <p className={`font-display font-600 ${wordMode === o.v ? 'text-signal-deep' : 'text-ink'}`}>{o.title}</p>
                <p className="mt-0.5 text-xs text-graphite">{o.desc}</p>
              </button>
            ))}
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} className="size-4 accent-[var(--color-signal-deep)]" />
            Reconocer texto de páginas escaneadas (OCR) <span className="font-mono text-[10px] text-graphite">— más lento</span>
          </label>
        </div>
      )}

      {busy && progress && (
        <ProgressBar value={pct} label={`Procesando página ${progress.done} de ${progress.total}…`} />
      )}

      <div className="flex justify-end">
        <Button onClick={run} loading={busy}><Download className="size-4" aria-hidden /> Convertir a {META[fmt].label} y descargar</Button>
      </div>
    </div>
  );
}

/** Previsualización (miniaturas) del PDF que se va a convertir. */
function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const { thumbnails, pageCount, loading } = usePdfThumbnails(bytes, 200);
  return (
    <div>
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-graphite">Vista previa {pageCount > 0 && <span className="opacity-70">({pageCount} pág.)</span>}</p>
      <div className="flex gap-3 overflow-x-auto rounded-[var(--radius-instrument)] border border-line bg-paper p-3">
        {thumbnails.map((t) => (
          <figure key={t.pageNumber} className="shrink-0">
            <img src={t.dataUrl} alt={`Página ${t.pageNumber}`} className="h-44 w-auto rounded border border-line shadow-sm" />
            <figcaption className="mt-1 text-center font-mono text-[10px] text-graphite">{t.pageNumber}</figcaption>
          </figure>
        ))}
        {loading && <div className="grid h-44 w-32 shrink-0 place-items-center rounded border border-dashed border-line text-graphite"><Loader2 className="size-5 animate-spin" /></div>}
      </div>
    </div>
  );
}
