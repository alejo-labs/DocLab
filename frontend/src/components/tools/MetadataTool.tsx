import { useEffect, useState, type KeyboardEvent } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Tags, Eraser, X } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { formatBytes, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { readInfo, readMetadata, writeMetadata, type PdfInfo } from '../../lib/pdf/metadata';
import { toast } from '../../lib/notify/toast';
import type { ToolEngineProps, ToolResult } from './types';

interface Editable {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
}

const EMPTY: Editable = { title: '', author: '', subject: '', keywords: [] };
const TEXT_FIELDS: { key: 'title' | 'author' | 'subject'; label: string }[] = [
  { key: 'title', label: 'Título' },
  { key: 'author', label: 'Autor' },
  { key: 'subject', label: 'Asunto' },
];

export function MetadataTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [size, setSize] = useState(0);
  const [meta, setMeta] = useState<Editable>(EMPTY);
  const [original, setOriginal] = useState<Editable>(EMPTY);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useReportProcessing(busy);

  async function load(data: Uint8Array, name: string) {
    setFileName(stripExtension(name));
    setSize(data.length);
    setBytes(data);
    try {
      const m = await readMetadata(data);
      const editable: Editable = { title: m.title, author: m.author, subject: m.subject, keywords: m.keywords.split(',').map((k) => k.trim()).filter(Boolean) };
      setMeta(editable);
      setOriginal(editable);
      setInfo(await readInfo(data));
    } catch {
      setMeta(EMPTY);
      setOriginal(EMPTY);
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

  function addKeyword() {
    const v = keywordInput.trim().replace(/,/g, '');
    if (!v) return;
    if (!meta.keywords.includes(v)) setMeta((m) => ({ ...m, keywords: [...m.keywords, v] }));
    setKeywordInput('');
  }
  function onKeywordKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    } else if (e.key === 'Backspace' && !keywordInput && meta.keywords.length) {
      setMeta((m) => ({ ...m, keywords: m.keywords.slice(0, -1) }));
    }
  }
  function clearAll() {
    setMeta(EMPTY);
    toast('Metadatos limpiados. Pulsa Guardar para aplicar.', 'info');
  }

  const changed = JSON.stringify(meta) !== JSON.stringify(original);
  const isMod = (k: 'title' | 'author' | 'subject') => meta[k] !== original[k];

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const out = await writeMetadata(bytes, { title: meta.title, author: meta.author, subject: meta.subject, keywords: meta.keywords.join(', ') });
      setResult({ bytes: out, filename: `${fileName}-metadatos.pdf` });
    } catch {
      setError('No se pudieron guardar los metadatos.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="metadata" onReset={() => { setBytes(null); setResult(null); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para ver y editar sus metadatos." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <ErrorAlert message={error} />}

      {/* Información solo lectura */}
      {info && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 text-sm sm:grid-cols-3">
          {[
            ['Páginas', String(info.pages)],
            ['Tamaño', formatBytes(size)],
            ['Creado', info.created],
            ['Modificado', info.modified],
            ['Creador', info.creator],
            ['Productor', info.producer],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-graphite">{k}</dt>
              <dd className="truncate text-ink" title={v}>{v}</dd>
            </div>
          ))}
        </div>
      )}

      {/* Campos editables */}
      <div className="space-y-4 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4">
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-graphite">
              {isMod(f.key) && <span className="size-1.5 rounded-full bg-ember" title="Modificado" />}
              {f.label}
            </span>
            <input value={meta[f.key]} onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))} className="rounded-md border border-line bg-paper px-3 py-2 text-ink focus:border-signal focus:outline-none" />
          </label>
        ))}

        {/* Palabras clave como chips */}
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-graphite">Palabras clave</span>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-2">
            {meta.keywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink">
                {kw}
                <button type="button" onClick={() => setMeta((m) => ({ ...m, keywords: m.keywords.filter((x) => x !== kw) }))} className="text-graphite hover:text-ember"><X className="size-3" /></button>
              </span>
            ))}
            <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={onKeywordKey} onBlur={addKeyword} placeholder={meta.keywords.length ? 'Añadir…' : 'Escribe y pulsa Enter'} className="min-w-24 flex-1 bg-transparent text-sm text-ink outline-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={run} loading={busy} disabled={!changed}><Tags className="size-4" aria-hidden /> Guardar metadatos</Button>
        <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-sm text-graphite hover:text-ember"><Eraser className="size-4" /> Limpiar todo</button>
        <span className="ml-auto font-mono text-xs text-graphite">{changed ? 'Cambios sin guardar' : 'Sin cambios'}</span>
        <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">Cambiar archivo</button>
      </div>
    </div>
  );
}
