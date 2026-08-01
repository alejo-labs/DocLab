import { CATEGORIES } from '../lib/categories';
import type { CategoryId } from '../lib/tools';

export type CategoryFilter = CategoryId | 'all';

interface CategoryChipsProps {
  active: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

export function CategoryChips({ active, onChange }: CategoryChipsProps) {
  const chip = (value: CategoryFilter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => onChange(value)}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active === value
          ? 'border-ink bg-ink text-paper'
          : 'border-line text-graphite hover:border-signal/50 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  // En móvil, fila con scroll horizontal (evita que las etiquetas largas salten a 3
  // líneas mal centradas); en pantallas ≥sm, se ajustan con flex-wrap.
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {chip('all', 'Todas')}
      {CATEGORIES.map((category) => chip(category.id, category.label))}
    </div>
  );
}
