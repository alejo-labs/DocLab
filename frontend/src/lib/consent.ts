/**
 * Estado de consentimiento de cookies/almacenamiento. DocLab NO usa cookies de
 * seguimiento ni analítica: todo lo que guarda es almacenamiento local de primera parte.
 * Se distinguen dos categorías:
 *  - `necessary` (siempre activas): el propio registro del consentimiento y el tema visual
 *    (recuerda la preferencia que TÚ eliges). Exentas de consentimiento.
 *  - `preferences` (opcionales): comodidades que se recuerdan entre visitas (p. ej. no
 *    volver a mostrar la bienvenida). Se activan solo si las aceptas.
 * No existen categorías de analítica ni de marketing porque no hacemos ni una cosa ni otra.
 */
export interface Consent {
  preferences: boolean;
  decidedAt: string;
}

const KEY = 'doclab-consent';
const CHANGE_EVT = 'doclab-consent-change';
const OPEN_EVT = 'doclab-open-cookie-settings';

/** Devuelve la decisión guardada, o `null` si el usuario aún no ha elegido. */
export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    return { preferences: parsed.preferences === true, decidedAt: parsed.decidedAt ?? '' };
  } catch {
    return null;
  }
}

/** ¿El usuario ya ha tomado una decisión sobre cookies? */
export function hasDecided(): boolean {
  return getConsent() !== null;
}

/** ¿Se pueden guardar preferencias opcionales (categoría no esencial)? */
export function preferencesAllowed(): boolean {
  return getConsent()?.preferences === true;
}

/** Guarda la decisión y notifica a la app. */
export function setConsent(preferences: boolean): void {
  const consent: Consent = { preferences, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    /* sin acceso a localStorage: no podemos recordar la elección, pero no rompemos nada */
  }
  if (!preferences) {
    // Respeta el rechazo: retira las comodidades opcionales ya guardadas.
    try { localStorage.removeItem('doclab-onboarded-v1'); } catch { /* ignore */ }
  }
  window.dispatchEvent(new CustomEvent<Consent>(CHANGE_EVT, { detail: consent }));
}

export const acceptAll = (): void => setConsent(true);
export const rejectOptional = (): void => setConsent(false);

/** Suscribe a los cambios de consentimiento. Devuelve la función para desuscribir. */
export function subscribeConsent(fn: (c: Consent | null) => void): () => void {
  const handler = () => fn(getConsent());
  window.addEventListener(CHANGE_EVT, handler);
  return () => window.removeEventListener(CHANGE_EVT, handler);
}

/** Abre el panel de configuración de cookies desde cualquier parte (footer, página de cookies). */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVT));
}

/** Escucha las peticiones de abrir la configuración de cookies. */
export function onOpenCookieSettings(fn: () => void): () => void {
  window.addEventListener(OPEN_EVT, fn);
  return () => window.removeEventListener(OPEN_EVT, fn);
}
