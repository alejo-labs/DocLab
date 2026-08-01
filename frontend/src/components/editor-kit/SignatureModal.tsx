import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { X, Pen, Type, Upload } from 'lucide-react';
import { Button } from '../ui';
import { readFileBytes, detectImageType, bytesToBase64, dataUrlToBytes } from '../../lib/files';

export interface SignatureResult {
  bytes: Uint8Array;
  format: 'png' | 'jpg';
  ratio: number; // ancho/alto
}

type Mode = 'draw' | 'type' | 'upload';

const STORAGE_KEY = 'doclab-signatures';

function loadSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Modal de firma: dibujar, teclear o subir. Guarda firmas en localStorage. */
export function SignatureModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (sig: SignatureResult) => void }) {
  const [mode, setMode] = useState<Mode>('draw');
  const [typed, setTyped] = useState('');
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#14161b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  function pos(e: ReactPointerEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function down(e: ReactPointerEvent) {
    drawingRef.current = true;
    dirtyRef.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: ReactPointerEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function up() {
    drawingRef.current = false;
  }
  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    dirtyRef.current = false;
  }

  function pngFromCanvas(c: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve) => c.toBlob((b) => b!.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))), 'image/png'));
  }

  async function confirmDraw() {
    const c = canvasRef.current!;
    if (!dirtyRef.current) return;
    const bytes = await pngFromCanvas(c);
    persist(bytes);
    onConfirm({ bytes, format: 'png', ratio: c.width / c.height });
  }

  async function confirmType() {
    if (!typed.trim()) return;
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 200;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#14161b';
    ctx.font = 'italic 80px "Brush Script MT", "Segoe Script", cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(typed, 20, 110);
    const bytes = await pngFromCanvas(c);
    persist(bytes);
    onConfirm({ bytes, format: 'png', ratio: c.width / c.height });
  }

  async function onUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const bytes = await readFileBytes(file);
    const fmt = detectImageType(bytes);
    if (!fmt) return;
    const ratio = await new Promise<number>((res) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer]));
      img.onload = () => {
        res(img.naturalWidth / img.naturalHeight || 2);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    onConfirm({ bytes, format: fmt, ratio });
  }

  function persist(bytes: Uint8Array) {
    const dataUrl = `data:image/png;base64,${bytesToBase64(bytes)}`;
    const next = [dataUrl, ...saved.filter((s) => s !== dataUrl)].slice(0, 6);
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento lleno: ignorar */
    }
  }

  async function pickSaved(dataUrl: string) {
    // Decodifica el base64 del data: URL directamente (sin fetch, que la CSP bloquea).
    const bytes = dataUrlToBytes(dataUrl);
    const ratio = await new Promise<number>((r) => {
      const img = new Image();
      img.onload = () => r(img.naturalWidth / img.naturalHeight || 2);
      img.src = dataUrl;
    });
    onConfirm({ bytes, format: 'png', ratio });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-600 text-ink">Tu firma</h3>
          <button type="button" onClick={onClose} className="text-graphite hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-md border border-line bg-paper p-0.5">
          {([['draw', 'Dibujar', Pen], ['type', 'Teclear', Type], ['upload', 'Subir', Upload]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm ${mode === m ? 'bg-ink text-paper' : 'text-graphite hover:text-ink'}`}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        {mode === 'draw' && (
          <>
            <canvas ref={canvasRef} width={600} height={200} className="w-full touch-none rounded-md border border-line bg-white" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            <div className="mt-3 flex justify-between">
              <button type="button" onClick={clearCanvas} className="text-sm text-graphite hover:text-ink">Limpiar</button>
              <Button onClick={confirmDraw}>Usar firma</Button>
            </div>
          </>
        )}
        {mode === 'type' && (
          <>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Escribe tu nombre" className="w-full rounded-md border border-line bg-white px-3 py-3 text-2xl text-ink focus:border-signal focus:outline-none" style={{ fontFamily: '"Brush Script MT","Segoe Script",cursive' }} />
            <div className="mt-3 flex justify-end">
              <Button onClick={confirmType} disabled={!typed.trim()}>Usar firma</Button>
            </div>
          </>
        )}
        {mode === 'upload' && (
          <label className="grid cursor-pointer place-items-center gap-2 rounded-md border-2 border-dashed border-line bg-white py-10 text-graphite hover:border-signal/50">
            <Upload className="size-6" />
            <span className="text-sm">Sube una imagen de tu firma (PNG/JPG)</span>
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onUpload(e.target.files)} />
          </label>
        )}

        {saved.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-graphite">Firmas guardadas</p>
            <div className="flex flex-wrap gap-2">
              {saved.map((s) => (
                <button key={s} type="button" onClick={() => pickSaved(s)} className="h-12 rounded border border-line bg-white p-1 hover:border-signal">
                  <img src={s} alt="firma guardada" className="h-full" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
