import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { FileText, Copy, Check, Download } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert, ProgressBar } from '../ui';
import { looksLikePdf, readFileBytes } from '../../lib/files';
import { downloadBlob, stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { extractText } from '../../lib/pdf/pdfToText';
import type { ToolEngineProps } from './types';

export function PdfToTextTool(_props: ToolEngineProps) {
  const [fileName, setFileName] = useState('documento');
  const [text, setText] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);
  const [copied, setCopied] = useState(false);

  async function run(data: Uint8Array) {
    setBusy(true);
    setError(null);
    setText(null);
    setProgress({ done: 0, total: 0 });
    try {
      const out = await extractText(data, (done, total) => setProgress({ done, total }));
      setText(out);
    } catch {
      setError('No se pudo extraer el texto. ¿El PDF es una imagen escaneada? (prueba OCR próximamente).');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  useEffect(() => {
    const h = takeHandoff();
    if (h) {
      setFileName(stripExtension(h.filename));
      run(h.bytes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    run(data);
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!text) return;
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${fileName}.txt`);
  }

  return (
    <div className="space-y-5">
      {text === null ? (
        <FileDropzone accept="application/pdf" hint="Sube un PDF para extraer todo su texto." onFiles={onFile} />
      ) : (
        <textarea
          readOnly
          value={text}
          className="h-96 w-full rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 font-mono text-sm text-ink focus:outline-none"
        />
      )}

      {error && <ErrorAlert message={error} />}

      {progress && busy && (
        <ProgressBar
          value={progress.total ? (progress.done / progress.total) * 100 : undefined}
          label={`Extrayendo texto… página ${progress.done} de ${progress.total}`}
        />
      )}

      {text !== null && (
        <div className="flex items-center gap-3">
          <Button onClick={download}>
            <Download className="size-4" aria-hidden />
            Descargar .txt
          </Button>
          <Button variant="ghost" onClick={copy}>
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <button type="button" onClick={() => setText(null)} className="ml-auto text-sm text-graphite hover:text-ink">
            <FileText className="mr-1 inline size-4" />
            Otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
