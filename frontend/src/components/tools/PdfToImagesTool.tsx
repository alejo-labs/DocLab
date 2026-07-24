import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { downloadZip } from 'client-zip';
import { Images } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { Segmented } from '../editor-kit/controls';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { pdfToImages, type ImageFormat } from '../../lib/pdf/pdfToImages';
import { getPageCount } from '../../lib/pdf/pdfjs';
import { parsePages } from '../../lib/pdf/layout';
import { downloadBlob, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import type { ToolEngineProps } from './types';

type Dpi = '72' | '150' | '300';
const DPI_SCALE: Record<Dpi, number> = { '72': 1, '150': 150 / 72, '300': 300 / 72 };

export function PdfToImagesTool({ preset }: ToolEngineProps) {
  // El formato lo fija la tarjeta (PDF a JPG / PDF a PNG); si no, por defecto PNG.
  const fixedFormat = preset?.format;
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [format, setFormat] = useState<ImageFormat>(fixedFormat ?? 'png');
  const [dpi, setDpi] = useState<Dpi>('150');
  const [pageRange, setPageRange] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  async function load(data: Uint8Array, name: string) {
    setFileName(stripExtension(name));
    setBytes(data);
    try {
      setPageCount(await getPageCount(data));
    } catch {
      setPageCount(0);
    }
  }

  // Encadenado desde otra herramienta.
  useEffect(() => {
    const handoff = takeHandoff();
    if (handoff) load(handoff.bytes, handoff.filename);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) {
      setError(`"${file.name}" no es un PDF válido.`);
      return;
    }
    await load(data, file.name);
  }

  async function run() {
    if (!bytes) return;
    setError(null);
    setBusy(true);
    setProgress({ done: 0, total: 0 });
    try {
      const selected = pageRange.trim() ? [...parsePages(pageRange, pageCount || 9999)].sort((a, b) => a - b) : undefined;
      const pages = await pdfToImages(bytes, format, DPI_SCALE[dpi], (done, total) => setProgress({ done, total }), selected);
      if (pages.length === 1) {
        downloadBlob(pages[0]!.blob, `${fileName}.${format}`);
      } else {
        const zipBlob = await downloadZip(
          pages.map((page) => ({ name: page.filename, input: page.blob })),
        ).blob();
        downloadBlob(zipBlob, `${fileName}-imagenes.zip`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron generar las imágenes.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone
          accept="application/pdf"
          hint="Sube un PDF para exportar cada página como imagen. Si tiene varias, se descargan en un ZIP."
          onFiles={onFile}
        />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      {!fixedFormat && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-graphite">Formato:</span>
          {(['png', 'jpg'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              className={`rounded-full border px-3 py-1 text-sm uppercase transition-colors ${
                format === value
                  ? 'border-signal bg-signal/10 text-signal-deep'
                  : 'border-line text-graphite hover:border-signal/40'
              }`}
            >
              {value}
            </button>
          ))}
          <span className="ml-2 font-mono text-xs text-graphite">
            {format === 'png' ? 'sin pérdidas, más peso' : 'menor peso, con pérdidas'}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-graphite">Resolución</p>
          <Segmented value={dpi} onChange={setDpi} options={[
            { value: '72', label: '72 · Pantalla' },
            { value: '150', label: '150 · Estándar' },
            { value: '300', label: '300 · Impresión' },
          ]} />
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-graphite">Páginas {pageCount > 0 ? `(1–${pageCount})` : ''}</span>
          <input value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="Todas · ej: 1-3, 5" className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-signal focus:outline-none" />
        </label>
      </div>

      {progress && progress.total > 0 && (
        <ProgressBar
          value={(progress.done / progress.total) * 100}
          label={`Renderizando página ${progress.done} de ${progress.total}…`}
        />
      )}

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy}>
          <Images className="size-4" aria-hidden />
          Convertir a {format.toUpperCase()}
        </Button>
        <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">
          Cambiar archivo
        </button>
      </div>
    </div>
  );
}
