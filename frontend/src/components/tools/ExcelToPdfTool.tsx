import { useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { FileSpreadsheet, Info } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { formatBytes, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import type { ToolEngineProps, ToolResult } from './types';

/** Un .xlsx es un ZIP: debe empezar por la firma "PK". */
function looksLikeXlsx(bytes: Uint8Array, name: string): boolean {
  const pk = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return pk && /\.xlsx$/i.test(name);
}

export function ExcelToPdfTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('hoja');
  const [size, setSize] = useState(0);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  async function onFile(files: File[]) {
    setError(null);
    setResult(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikeXlsx(data, file.name)) return setError(`"${file.name}" no es un Excel (.xlsx) válido.`);
    setFileName(stripExtension(file.name));
    setSize(data.length);
    setBytes(data);
  }

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const { xlsxToPdf } = await import('../../lib/office/xlsxToPdf');
      const out = await xlsxToPdf(bytes);
      setResult({ bytes: out, filename: `${fileName}.pdf` });
    } catch {
      setError('No se pudo convertir el Excel. ¿Está protegido con contraseña o dañado?');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="excel-to-pdf" onReset={() => { setResult(null); setBytes(null); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hint="Sube un Excel (.xlsx) para convertirlo a PDF conservando bordes, colores y negritas. Todo en tu dispositivo." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] border border-line text-signal-deep"><FileSpreadsheet className="size-5" aria-hidden /></span>
          <div>
            <p className="font-medium text-ink">{fileName}.xlsx</p>
            <p className="font-mono text-xs text-graphite">{formatBytes(size)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { setBytes(null); setError(null); }} className="text-graphite hover:text-ink">Cambiar archivo</button>
      </div>

      <div className="flex items-start gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-4 py-3 text-sm text-graphite">
        <Info className="mt-0.5 size-4 shrink-0 text-signal-deep" aria-hidden />
        <span>Se conservan <strong>bordes</strong> (con su grosor), <strong>colores de celda</strong>, <strong>negritas/cursivas</strong>, alineación y celdas combinadas. Cada hoja se ajusta al ancho de página. Fuentes reales y gráficos llegarán en una próxima versión.</span>
      </div>

      <div className="flex justify-end">
        <Button onClick={run} loading={busy}><FileSpreadsheet className="size-4" aria-hidden /> Convertir a PDF y descargar</Button>
      </div>
    </div>
  );
}
