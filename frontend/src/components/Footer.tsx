import { Link } from 'react-router-dom';
import { Lock, Keyboard } from 'lucide-react';
import { openShortcuts } from '../lib/uiEvents';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-graphite sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-mono text-xs">
          <Lock className="size-3.5 text-signal-deep" aria-hidden />
          Tus archivos no salen de tu dispositivo salvo que lo elijas explícitamente.
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={openShortcuts} className="inline-flex items-center gap-1.5 transition-colors hover:text-ink" title="Atajos de teclado (?)">
            <Keyboard className="size-3.5" /> Atajos
          </button>
          <Link to="/privacidad" className="transition-colors hover:text-ink">
            Privacidad
          </Link>
          <span className="font-mono text-xs">DocLab · {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
