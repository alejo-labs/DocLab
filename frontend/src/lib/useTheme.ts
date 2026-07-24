import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'doclab-theme';

/** Tema inicial: preferencia guardada o la del sistema. Se llama también en main.tsx. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* sin acceso a localStorage */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica el tema al <html> (data-theme). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || initialTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* ignorar */
    }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
}
