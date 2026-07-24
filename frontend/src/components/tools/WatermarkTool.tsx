import { useEffect, useState } from 'react';
import { useReportProcessing } from '../../lib/processing';
import { Stamp, Image as ImageIcon, Type } from 'lucide-react';
import { FileDropzone } from '../FileDropzone';
import { Button, ErrorAlert } from '../ui';
import { ResultPreview } from '../ResultPreview';
import { ColorControl, LabeledSlider, Segmented } from '../editor-kit/controls';
import { LivePreview } from '../editor-kit/LivePreview';
import { PositionGrid } from '../editor-kit/PositionGrid';
import { detectImageType, looksLikePdf, readFileBytes } from '../../lib/files';
import { stripExtension } from '../../lib/pdf/download';
import { takeHandoff } from '../../lib/handoff';
import { addWatermark, type WatermarkPages } from '../../lib/pdf/watermark';
import { FONTS, type FontFamily } from '../../lib/pdf/annotations';
import type { Position } from '../../lib/pdf/layout';
import type { ToolEngineProps, ToolResult } from './types';

const PRESETS = ['CONFIDENCIAL', 'BORRADOR', 'COPIA', 'APROBADO', 'MUESTRA', 'NO VÁLIDO'];

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

export function WatermarkTool(_props: ToolEngineProps) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState('documento');
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENCIAL');
  const [color, setColor] = useState('#f2683c');
  const [font, setFont] = useState<FontFamily>('helvetica');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [tile, setTile] = useState(false);
  const [position, setPosition] = useState<Position>('center');
  const [pages, setPages] = useState<WatermarkPages>('all');
  const [range, setRange] = useState('');
  const [image, setImage] = useState<{ bytes: Uint8Array; format: 'png' | 'jpg'; url: string } | null>(null);
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
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  async function onFile(files: File[]) {
    setError(null);
    const file = files[0];
    if (!file) return;
    const data = await readFileBytes(file);
    if (!looksLikePdf(data)) return setError(`"${file.name}" no es un PDF válido.`);
    setFileName(stripExtension(file.name));
    setBytes(data);
  }
  async function onImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const data = await readFileBytes(file);
    const fmt = detectImageType(data);
    if (!fmt) return setError('La marca de agua debe ser una imagen JPG o PNG.');
    setImage({ bytes: data, format: fmt, url: URL.createObjectURL(new Blob([data.slice().buffer])) });
  }

  async function run() {
    if (!bytes) return;
    setBusy(true);
    setError(null);
    try {
      const out = await addWatermark(bytes, { mode, text, color, font, fontSize, image: image ? { bytes: image.bytes, format: image.format } : null, imageWidth: 160, opacity, rotation, tile, position, pages, range });
      setResult({ bytes: out, filename: `${fileName}-marca.pdf` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar la marca de agua.');
    } finally {
      setBusy(false);
    }
  }

  if (result) return <ResultPreview result={result} currentEngine="watermark" onReset={() => { setBytes(null); setResult(null); }} />;

  if (!bytes) {
    return (
      <div className="space-y-5">
        <FileDropzone accept="application/pdf" hint="Sube un PDF para estampar una marca de agua." onFiles={onFile} />
        {error && <ErrorAlert message={error} />}
      </div>
    );
  }

  const overlay = (dims: { width: number }) => {
    const scale = dims.width / 595;
    const el = mode === 'text'
      ? <span style={{ color, opacity, fontSize: fontSize * scale, fontFamily: FONTS[font].css, transform: `rotate(${rotation}deg)`, whiteSpace: 'nowrap', fontWeight: 700 }}>{text}</span>
      : image ? <img src={image.url} alt="" style={{ width: 160 * scale, opacity, transform: `rotate(${rotation}deg)` }} /> : null;
    if (tile) {
      return (
        <div className="flex h-full w-full flex-wrap content-center justify-center gap-6 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => <span key={i}>{el}</span>)}
        </div>
      );
    }
    return <div className="flex h-full w-full p-3" style={{ justifyContent: FLEX[position].justify, alignItems: FLEX[position].align }}>{el}</div>;
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Configuración */}
      <div className="min-w-0 flex-1 space-y-4">
        {error && <ErrorAlert message={error} />}

        <Segmented value={mode} onChange={setMode} options={[{ value: 'text', label: 'Texto', icon: <Type className="size-3.5" /> }, { value: 'image', label: 'Imagen', icon: <ImageIcon className="size-3.5" /> }]} />

        {mode === 'text' ? (
          <>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-graphite">Texto</span>
              <input value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-line bg-paper px-3 py-2 text-ink focus:border-signal focus:outline-none" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setText(p)} className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${text === p ? 'border-signal bg-signal/10 text-signal-deep' : 'border-line text-graphite hover:border-signal/40'}`}>{p}</button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="mb-1.5 text-xs font-medium text-graphite">Color</p><ColorControl value={color} onChange={(c) => setColor(c!)} /></div>
              <div><p className="mb-1.5 text-xs font-medium text-graphite">Tipografía</p><Segmented value={font} onChange={setFont} options={(Object.keys(FONTS) as FontFamily[]).map((f) => ({ value: f, label: FONTS[f].label }))} /></div>
            </div>
            <LabeledSlider label="Tamaño" value={fontSize} min={18} max={120} unit="pt" onChange={setFontSize} />
          </>
        ) : (
          <div className="flex items-center gap-3">
            {image ? <img src={image.url} alt="" className="h-16 rounded border border-line bg-white p-1" /> : null}
            <label className="cursor-pointer rounded-md border border-line bg-paper-raised px-4 py-2 text-sm text-ink hover:border-signal/50">
              {image ? 'Cambiar imagen' : 'Subir imagen (logo/firma)'}
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { onImage(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledSlider label="Opacidad" value={opacity * 100} min={5} max={100} unit="%" onChange={(v) => setOpacity(v / 100)} />
          <LabeledSlider label="Rotación" value={rotation} min={0} max={90} unit="°" onChange={setRotation} />
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="mb-1.5 text-xs font-medium text-graphite">Posición</p>
            <PositionGrid value={position} onChange={setPosition} />
            <label className="mt-2 flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} className="size-4 accent-signal" /> Mosaico</label>
          </div>
          <div className="flex-1">
            <p className="mb-1.5 text-xs font-medium text-graphite">Aplicar a</p>
            <Segmented value={pages} onChange={setPages} options={[{ value: 'all', label: 'Todas' }, { value: 'even', label: 'Pares' }, { value: 'odd', label: 'Impares' }, { value: 'range', label: 'Rango' }]} />
            {pages === 'range' && <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3, 5" className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink focus:border-signal focus:outline-none" />}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={run} loading={busy} disabled={mode === 'text' ? !text.trim() : !image}><Stamp className="size-4" aria-hidden /> Aplicar marca de agua</Button>
          <button type="button" onClick={() => setBytes(null)} className="text-sm text-graphite hover:text-ink">Cambiar archivo</button>
        </div>
      </div>

      {/* Vista previa en vivo */}
      <div className="lg:sticky lg:top-24">
        <p className="mb-2 text-xs font-medium text-graphite">Vista previa</p>
        <LivePreview bytes={bytes} width={300} overlay={overlay} />
      </div>
    </div>
  );
}
