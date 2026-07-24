/**
 * Traspaso en memoria del resultado de una herramienta a la siguiente (encadenado),
 * sin re-subir el archivo ni serializarlo. Vive solo durante la sesión de la SPA;
 * coherente con la privacidad: nada se persiste.
 */
export interface Handoff {
  bytes: Uint8Array;
  filename: string;
}

let pending: Handoff | null = null;

/** Guarda el resultado para que lo recoja la siguiente herramienta. */
export function setHandoff(handoff: Handoff): void {
  pending = handoff;
}

/** Recoge (y limpia) el resultado pendiente. Devuelve null si no hay ninguno. */
export function takeHandoff(): Handoff | null {
  const current = pending;
  pending = null;
  return current;
}
