import type { Position } from '../../lib/pdf/layout';

const ROWS: { row: 'top' | 'center' | 'bottom'; label: string }[] = [
  { row: 'top', label: 'Arriba' },
  { row: 'center', label: 'Centro' },
  { row: 'bottom', label: 'Abajo' },
];
const COLS: { col: 'left' | 'center' | 'right'; label: string }[] = [
  { col: 'left', label: 'izquierda' },
  { col: 'center', label: 'centro' },
  { col: 'right', label: 'derecha' },
];

function key(row: string, col: string): Position {
  return (row === 'center' && col === 'center' ? 'center' : `${row}-${col}`) as Position;
}

/** Selector visual de posición sobre una "página" (3×3). Reutilizable. */
export function PositionGrid({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  return (
    <div className="relative aspect-[0.72] w-28 rounded-md border border-line bg-white p-2 shadow-sm">
      <div className="grid h-full grid-cols-3 grid-rows-3">
        {ROWS.map((r) =>
          COLS.map((c) => {
            const k = key(r.row, c.col);
            const active = value === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onChange(k)}
                title={`${r.label} ${c.label}`}
                className="grid place-items-center"
              >
                <span className={`size-2.5 rounded-full transition-colors ${active ? 'bg-signal ring-2 ring-signal/30' : 'bg-line hover:bg-graphite'}`} />
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
