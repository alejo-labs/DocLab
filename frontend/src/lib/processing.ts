import { createContext, useContext, useEffect } from 'react';
import type { Processing } from './tools';

/**
 * Señal global de "procesando" + tipo de procesamiento (on-device / servidor efímero),
 * para mostrar un único banner de privacidad transversal mientras cualquier herramienta trabaja.
 * Patrón emisor (como el toast): la herramienta reporta su `busy`; el banner lo escucha.
 */

/** Contexto que provee el tipo de procesamiento de la herramienta activa (lo fija ToolPage). */
export const ProcessingTypeContext = createContext<Processing>('on-device');

type Listener = (active: Processing | null) => void;
let current: Processing | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeProcessing(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** Una herramienta llama a esto con su estado `busy`; reporta inicio/fin del procesamiento. */
export function useReportProcessing(active: boolean): void {
  const type = useContext(ProcessingTypeContext);
  useEffect(() => {
    if (!active) return;
    current = type;
    emit();
    return () => {
      current = null;
      emit();
    };
  }, [active, type]);
}
