import { ShieldCheck, Server } from 'lucide-react';
import type { Processing } from '../lib/tools';

interface OnDeviceBadgeProps {
  processing: Processing;
  /** size compacto para tarjetas, normal para cabeceras de herramienta. */
  size?: 'sm' | 'md';
}

/**
 * Elemento FIRMA de DocLab: chip de telemetría que comunica la tesis de privacidad.
 * - on-device: el archivo nunca sale del navegador (0 bytes subidos).
 * - ephemeral-server: procesado en un contenedor efímero que no retiene nada.
 */
export function OnDeviceBadge({ processing, size = 'sm' }: OnDeviceBadgeProps) {
  const isOnDevice = processing === 'on-device';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  if (isOnDevice) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-signal/40 bg-signal/10 font-mono font-medium tracking-wide text-signal-deep ${padding}`}
        title="Este proceso ocurre 100% en tu navegador. Ningún archivo se sube a internet."
      >
        <span className="relative flex size-1.5">
          <span className="doclab-live-dot absolute inline-flex size-1.5 rounded-full bg-signal" />
          <span className="relative inline-flex size-1.5 rounded-full bg-signal-deep" />
        </span>
        ON-DEVICE · 0 B SUBIDOS
        <ShieldCheck className="size-3" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-ember/40 bg-ember/10 font-mono font-medium tracking-wide text-ember ${padding}`}
      title="Procesado en un contenedor efímero que no almacena tus archivos. Se purga en memoria tras la conversión."
    >
      <Server className="size-3" aria-hidden />
      SERVIDOR EFÍMERO · SIN RETENCIÓN
    </span>
  );
}
