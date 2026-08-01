import { FileText, Layers, HardDrive, ShieldCheck } from 'lucide-react';
import { LivePreview } from './editor-kit/LivePreview';
import { formatBytes } from '../lib/files';
import { OnDeviceBadge } from './OnDeviceBadge';

interface DocumentPreviewInspectorProps {
  bytes: Uint8Array | null;
  fileName: string;
  onClear?: () => void;
  width?: number;
}

export function DocumentPreviewInspector({ bytes, fileName, onClear, width = 340 }: DocumentPreviewInspectorProps) {
  if (!bytes) return null;

  return (
    <div className="flex flex-col items-center rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-4 lg:w-[380px] lg:shrink-0 lg:h-full lg:overflow-y-auto">
      <div className="mb-3 flex w-full items-center justify-between">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-signal-deep flex items-center gap-1.5">
          <FileText className="size-3.5" aria-hidden /> Vista previa del PDF
        </p>
        {onClear && (
          <button type="button" onClick={onClear} className="text-xs text-graphite hover:text-ink transition-colors">
            Cambiar archivo
          </button>
        )}
      </div>

      <div className="mb-4 flex justify-center w-full">
        <LivePreview bytes={bytes} width={width} />
      </div>

      {/* Tarjeta de metadatos y estadísticas */}
      <div className="w-full space-y-2 rounded-lg border border-line/70 bg-paper/60 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-graphite flex items-center gap-1">
            <HardDrive className="size-3" /> Fichero:
          </span>
          <span className="font-mono font-medium text-ink truncate max-w-[200px]" title={fileName}>
            {fileName}.pdf
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-graphite flex items-center gap-1">
            <Layers className="size-3" /> Tamaño:
          </span>
          <span className="font-mono font-medium text-ink">
            {formatBytes(bytes.byteLength)}
          </span>
        </div>

        <div className="pt-1 flex justify-between items-center border-t border-line/40">
          <span className="font-mono text-graphite text-[11px] flex items-center gap-1">
            <ShieldCheck className="size-3 text-signal-deep" /> Seguridad:
          </span>
          <OnDeviceBadge processing="on-device" size="sm" />
        </div>
      </div>
    </div>
  );
}
