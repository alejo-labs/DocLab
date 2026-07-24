import { useEffect } from 'react';

/**
 * Ajusta el `<title>` y la meta description por página (SPA). Google renderiza JS, así que
 * esto mejora el SEO de cada ruta —sobre todo de cada herramienta— y la usabilidad (título
 * de la pestaña). Para redes sociales, el Open Graph estático de `index.html` (portada) es
 * el que ven los rastreadores, que no ejecutan JS.
 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let el = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', 'description');
        document.head.appendChild(el);
      }
      el.setAttribute('content', description);
    }
  }, [title, description]);
}
