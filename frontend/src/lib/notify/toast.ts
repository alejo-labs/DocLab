export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();

/** Suscribe el Toaster a los avisos. Devuelve la función para desuscribir. */
export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Emite un aviso (toast) desde cualquier parte de la app. */
export function toast(message: string, tone: ToastTone = 'success'): void {
  const item: ToastItem = { id: crypto.randomUUID(), message, tone };
  listeners.forEach((l) => l(item));
}
