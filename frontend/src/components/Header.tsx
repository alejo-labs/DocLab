import { Link } from 'react-router-dom';
import { Moon, Sun, Code2 } from 'lucide-react';
import { useTheme } from '../lib/useTheme';

export function Header() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="DocLab, inicio">
          {/* Marca: un cuadrante de instrumento con un punto vivo. */}
          <span className="relative grid size-9 place-items-center rounded-[10px] bg-ink text-paper">
            <span className="font-display text-lg font-700 leading-none">D</span>
            <span className="doclab-live-dot absolute right-1 top-1 size-1.5 rounded-full bg-signal" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-600 tracking-tight text-ink">
              Doc<span className="text-signal-deep">Lab</span>
            </span>
            <span className="font-mono text-[10px] tracking-wide text-graphite">
              instrumentos de PDF · local-first
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/como-funciona"
            className="hidden rounded-md px-3 py-2 font-medium text-graphite transition-colors hover:bg-ink/5 hover:text-ink sm:inline-flex"
          >
            Cómo funciona
          </Link>
          <Link
            to="/seguridad"
            className="hidden rounded-md px-3 py-2 font-medium text-graphite transition-colors hover:bg-ink/5 hover:text-ink sm:inline-flex"
          >
            Seguridad
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="grid size-9 place-items-center rounded-md text-graphite transition-colors hover:bg-ink/5 hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
          <a
            href="https://github.com/alejo-labs/DocLab"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Código en GitHub"
            title="Código en GitHub"
            className="grid size-9 place-items-center rounded-md text-graphite transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <Code2 className="size-5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
