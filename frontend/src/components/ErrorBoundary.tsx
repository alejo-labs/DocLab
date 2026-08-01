import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  /** Contexto para el mensaje (p. ej. el nombre de la herramienta). */
  label?: string;
  /** Al cambiar esta clave, el boundary se reinicia (p. ej. navegar a otra herramienta). */
  resetKey?: string | number;
}
interface State { error: Error | null }

/**
 * Captura errores de render de sus hijos y muestra una recuperación amable en lugar de
 * romper toda la app. Los datos del usuario nunca salen del dispositivo, así que un fallo
 * es siempre local y recuperable (reintentar / recargar).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid place-items-center rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-10 text-center">
        <span className="grid size-12 place-items-center rounded-full border border-ember/40 bg-ember/10 text-ember">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <p className="mt-4 font-display text-lg font-600 text-ink">
          Algo ha fallado{this.props.label ? ` en ${this.props.label}` : ''}
        </p>
        <p className="mt-1 max-w-md text-sm text-graphite">
          Este documento puede tener una estructura poco habitual. Prueba con otro archivo o recarga la página.
          Tus datos no han salido de tu dispositivo.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={this.reset}><RotateCcw className="size-4" aria-hidden /> Reintentar</Button>
          <button type="button" onClick={() => window.location.reload()} className="text-sm text-graphite hover:text-ink">
            Recargar la página
          </button>
        </div>
      </div>
    );
  }
}
