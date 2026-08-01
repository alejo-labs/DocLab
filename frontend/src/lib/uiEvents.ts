/** Abre el overlay de atajos de teclado desde cualquier parte de la app. */
export function openShortcuts(): void {
  window.dispatchEvent(new Event('doclab-open-shortcuts'));
}
