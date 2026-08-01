import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { acceptAll, rejectOptional, setConsent, getConsent, hasDecided, onOpenCookieSettings } from '../lib/consent';

/**
 * Consentimiento de cookies/almacenamiento. Banner en la primera visita + panel de
 * configuración reabrible desde el footer o la página de Cookies. DocLab no usa
 * rastreadores, así que el panel es honesto: solo hay categoría necesaria y opcional.
 */
export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState(false);

  useEffect(() => {
    if (!hasDecided()) setShowBanner(true);
    return onOpenCookieSettings(() => {
      setPrefs(getConsent()?.preferences ?? false);
      setShowSettings(true);
    });
  }, []);

  function decide(action: () => void) {
    action();
    setShowBanner(false);
    setShowSettings(false);
  }

  if (!showBanner && !showSettings) return null;

  return (
    <>
      {/* Banner de primera visita */}
      {showBanner && !showSettings && (
        <div className="doclab-processing-in fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper-raised/95 backdrop-blur" role="region" aria-label="Aviso de cookies">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 size-5 shrink-0 text-signal-deep" aria-hidden />
              <p className="text-sm text-graphite">
                DocLab <strong className="text-ink">no usa cookies de seguimiento ni analítica</strong>. Solo guardamos
                en tu navegador ajustes técnicos y, si lo aceptas, alguna preferencia para recordar entre visitas.{' '}
                <Link to="/cookies" className="font-medium text-signal-deep hover:underline">Más información</Link>.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">
              <button type="button" onClick={() => setShowSettings(true)} className="rounded-[var(--radius-instrument)] px-3 py-2 text-sm font-medium text-graphite transition-colors hover:text-ink">
                Configurar
              </button>
              <button type="button" onClick={() => decide(rejectOptional)} className="rounded-[var(--radius-instrument)] border border-line bg-paper px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-signal/50">
                Rechazar opcionales
              </button>
              <button type="button" onClick={() => decide(acceptAll)} className="rounded-[var(--radius-instrument)] bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft">
                Aceptar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de configuración */}
      {showSettings && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Configuración de cookies" onClick={() => setShowSettings(false)}>
          <div className="doclab-processing-in w-full max-w-lg rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="size-5 text-signal-deep" aria-hidden />
                <h2 className="font-display text-xl font-700 tracking-tight text-ink">Configuración de cookies</h2>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} aria-label="Cerrar" className="grid size-8 place-items-center rounded-md text-graphite hover:bg-ink/5 hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-3 text-sm text-graphite">
              No usamos rastreadores. Estas son las dos únicas categorías de almacenamiento local:
            </p>

            <div className="mt-4 space-y-3">
              {/* Necesarias */}
              <div className="flex items-start gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-signal-deep" aria-hidden />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-base font-600 text-ink">Necesarias</h3>
                    <span className="rounded-full bg-signal/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-signal-deep">Siempre activas</span>
                  </div>
                  <p className="mt-1 text-sm text-graphite">Recuerdan tu decisión sobre cookies y el tema visual (claro/oscuro). Sin ellas la página no puede respetar tus ajustes.</p>
                </div>
              </div>

              {/* Preferencias */}
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-instrument)] border border-line bg-paper p-4">
                <input type="checkbox" checked={prefs} onChange={(e) => setPrefs(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-signal-deep)]" />
                <div className="flex-1">
                  <h3 className="font-display text-base font-600 text-ink">Preferencias (opcionales)</h3>
                  <p className="mt-1 text-sm text-graphite">Recuerdan comodidades entre visitas, como no volver a mostrarte la bienvenida. Puedes rechazarlas sin perder ninguna función.</p>
                </div>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => decide(rejectOptional)} className="rounded-[var(--radius-instrument)] px-3.5 py-2 text-sm font-medium text-graphite transition-colors hover:text-ink">
                Rechazar opcionales
              </button>
              <button type="button" onClick={() => decide(() => setConsent(prefs))} className="rounded-[var(--radius-instrument)] bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft">
                Guardar preferencias
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
