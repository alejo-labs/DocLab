import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { onToast, type ToastItem } from '../lib/notify/toast';

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const ACCENT = { success: 'border-l-signal text-signal-deep', error: 'border-l-ember text-ember', info: 'border-l-graphite text-graphite' };

/** Pila de toasts (esquina inferior derecha). Montado una vez en el AppShell. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return onToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    });
  }, []);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={`doclab-toast pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-instrument)] border border-line border-l-[3px] bg-paper-raised px-4 py-3 text-sm text-ink shadow-[0_4px_16px_rgba(20,22,27,0.12)] ${ACCENT[t.tone]}`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="text-ink">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} className="ml-1 text-graphite hover:text-ink" aria-label="Cerrar">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
