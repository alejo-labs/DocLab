import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'General',
    items: [
      [['?'], 'Mostrar atajos'],
      [['Esc'], 'Deseleccionar / cerrar'],
    ],
  },
  {
    title: 'Editor PDF',
    items: [
      [['Ctrl', 'Z'], 'Deshacer'],
      [['Ctrl', 'Shift', 'Z'], 'Rehacer'],
      [['Ctrl', 'D'], 'Duplicar elemento'],
      [['Supr'], 'Borrar selección'],
      [['←', '↑', '↓', '→'], 'Mover (Shift = 10×)'],
    ],
  },
  {
    title: 'Selección de páginas',
    items: [[['Shift', 'clic'], 'Seleccionar un rango']],
  },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
      if (e.key === '?' && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') setOpen(false);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('doclab-open-shortcuts', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('doclab-open-shortcuts', onOpen);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-600 text-ink"><Keyboard className="size-5 text-signal-deep" /> Atajos de teclado</h3>
          <button type="button" onClick={() => setOpen(false)} className="text-graphite hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="space-y-4">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-graphite">{g.title}</p>
              <ul className="space-y-1.5">
                {g.items.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{label}</span>
                    <span className="flex items-center gap-1">
                      {keys.map((k) => (
                        <kbd key={k} className="rounded border border-line border-b-2 bg-paper px-1.5 py-0.5 font-mono text-[11px] text-graphite">{k}</kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
