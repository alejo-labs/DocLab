import { useEffect } from 'react';

export interface ShortcutHandlers {
  onDelete?: () => void;
  onEscape?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicate?: () => void;
  /** Mover selección: dx,dy en px de pantalla (Shift = paso grande). */
  onNudge?: (dx: number, dy: number) => void;
}

/** Atajos de teclado del editor. Ignora cuando se escribe en inputs/textarea. */
export function useShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handlers.onRedo?.();
        else handlers.onUndo?.();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handlers.onRedo?.();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onDuplicate?.();
        return;
      }
      if (typing) return; // el resto de atajos no aplican mientras se escribe

      if (e.key === 'Escape') handlers.onEscape?.();
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handlers.onDelete?.();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const map: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const d = map[e.key];
        if (d) handlers.onNudge?.(d[0], d[1]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, enabled]);
}
