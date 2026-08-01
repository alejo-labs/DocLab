import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

type Variant = 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft disabled:bg-graphite',
  ghost: 'border border-line bg-paper-raised text-ink hover:border-signal/50 hover:text-signal-deep',
  danger: 'border border-ember/40 bg-ember/10 text-ember hover:bg-ember/20',
};

export function Button({ variant = 'primary', loading = false, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-instrument)] px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${rest.className ?? ''}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

interface ProgressBarProps {
  /** Progreso 0–100 (se acota). Omite `value` para una barra indeterminada. */
  value?: number;
  /** Texto de estado (visible y usado como etiqueta accesible). */
  label?: string;
}

/**
 * Barra de progreso accesible y unificada para todas las herramientas.
 * Expone `role="progressbar"` con `aria-valuenow/min/max` para lectores de pantalla y
 * respeta `prefers-reduced-motion` (sin animación de ancho). Sin `value` → indeterminada.
 */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const indeterminate = value === undefined;
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label ?? 'Progreso'}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(indeterminate ? {} : { 'aria-valuenow': pct })}
        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={`h-full rounded-full bg-signal-deep transition-all motion-reduce:transition-none ${indeterminate ? 'w-1/3 doclab-progress-indeterminate' : ''}`}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
      {label && <p className="mt-1.5 font-mono text-xs text-graphite">{label}</p>}
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[var(--radius-instrument)] border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-ember"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
