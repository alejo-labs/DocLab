/** Dispara la descarga de unos bytes como archivo, liberando el object URL. */
export function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/pdf'): void {
  // Copia a un ArrayBuffer "limpio" para el Blob.
  const blob = new Blob([bytes.slice().buffer], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoca en el siguiente tick para no cancelar la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quita la extensión de un nombre de archivo para componer el nombre de salida. */
export function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}
