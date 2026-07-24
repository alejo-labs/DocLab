import { Link } from 'react-router-dom';
import { Lock, Keyboard, Code2, Cookie } from 'lucide-react';
import { openShortcuts } from '../lib/uiEvents';
import { openCookieSettings } from '../lib/consent';

const REPO = 'https://github.com/alejo-labs/DocLab';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-raised/40">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marca */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="relative grid size-9 place-items-center rounded-[10px] bg-ink text-paper">
                <span className="font-display text-lg font-700 leading-none">D</span>
                <span className="doclab-live-dot absolute right-1 top-1 size-1.5 rounded-full bg-signal" />
              </span>
              <span className="font-display text-lg font-600 tracking-tight text-ink">
                Doc<span className="text-signal-deep">Lab</span>
              </span>
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm text-graphite">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-signal-deep" aria-hidden />
              Tus archivos se procesan en tu dispositivo y no salen de él.
            </p>
          </div>

          {/* Producto */}
          <nav aria-label="Producto">
            <h2 className="font-mono text-xs uppercase tracking-wide text-graphite">Producto</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/" className="text-graphite transition-colors hover:text-ink">Inicio</Link></li>
              <li><Link to="/como-funciona" className="text-graphite transition-colors hover:text-ink">Cómo funciona</Link></li>
              <li><Link to="/seguridad" className="text-graphite transition-colors hover:text-ink">Seguridad</Link></li>
              <li><Link to="/sobre" className="text-graphite transition-colors hover:text-ink">Sobre DocLab</Link></li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal">
            <h2 className="font-mono text-xs uppercase tracking-wide text-graphite">Legal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/privacidad" className="text-graphite transition-colors hover:text-ink">Privacidad</Link></li>
              <li><Link to="/cookies" className="text-graphite transition-colors hover:text-ink">Cookies</Link></li>
              <li><Link to="/aviso-legal" className="text-graphite transition-colors hover:text-ink">Aviso legal</Link></li>
              <li>
                <button type="button" onClick={openCookieSettings} className="inline-flex items-center gap-1.5 text-graphite transition-colors hover:text-ink">
                  <Cookie className="size-3.5" aria-hidden /> Configurar cookies
                </button>
              </li>
            </ul>
          </nav>

          {/* Recursos */}
          <nav aria-label="Recursos">
            <h2 className="font-mono text-xs uppercase tracking-wide text-graphite">Recursos</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href={REPO} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-graphite transition-colors hover:text-ink">
                  <Code2 className="size-3.5" aria-hidden /> Código (GitHub)
                </a>
              </li>
              <li>
                <button type="button" onClick={openShortcuts} className="inline-flex items-center gap-1.5 text-graphite transition-colors hover:text-ink">
                  <Keyboard className="size-3.5" aria-hidden /> Atajos de teclado
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-graphite sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono">DocLab · {new Date().getFullYear()} · Proyecto de código abierto</span>
          <span className="font-mono">Hecho con foco en la privacidad · 100% en el navegador</span>
        </div>
      </div>
    </footer>
  );
}
