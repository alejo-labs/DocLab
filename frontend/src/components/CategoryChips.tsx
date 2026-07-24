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
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active === value
          ? 'border-ink bg-ink text-paper'
          : 'border-line text-graphite hover:border-signal/50 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {chip('all', 'Todas')}
      {CATEGORIES.map((category) => chip(category.id, category.label))}
    </div>
  );
}
