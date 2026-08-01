import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { PageHero, Prose, Section, DefRow, Mono } from '../components/page-kit';
import { openCookieSettings } from '../lib/consent';
import { usePageMeta } from '../lib/usePageMeta';

const UPDATED = 'julio de 2026';

export function Cookies() {
  usePageMeta(
    'Cookies · DocLab',
    'DocLab no usa cookies de seguimiento ni analítica. Solo almacenamiento local de primera parte para que la herramienta funcione y recuerde tus ajustes.',
  );
  return (
    <>
      <PageHero
        kicker="Cookies y almacenamiento"
        title={<>Sin rastreadores. <span className="text-signal-deep">De verdad.</span></>}
        lead="DocLab no usa cookies de seguimiento, ni analítica, ni publicidad. Lo poco que guardamos vive en tu navegador y sirve para que la herramienta funcione y recuerde tus ajustes."
      />

      <Prose>
        <Section title="¿Usáis cookies?">
          <p>
            En sentido estricto, no colocamos cookies de terceros ni de seguimiento. Usamos una pequeña cantidad de
            <strong> almacenamiento local</strong> de primera parte (la API <Mono>localStorage</Mono> del navegador), que
            no se envía a ningún servidor y que puedes borrar en cualquier momento desde tu navegador.
          </p>
        </Section>

        <Section title="Qué guardamos exactamente">
          <div className="overflow-hidden rounded-[var(--radius-instrument)] border border-line bg-paper-raised">
            <dl className="px-5">
              <DefRow term={<Mono>doclab-consent</Mono>}>
                <span className="mb-1 block"><span className="rounded-full bg-signal/10 px-2 py-0.5 font-mono text-[11px] text-signal-deep">Necesaria</span></span>
                Tu decisión sobre esta misma ventana de cookies, para no volver a preguntártela.
              </DefRow>
              <DefRow term={<Mono>doclab-theme</Mono>}>
                <span className="mb-1 block"><span className="rounded-full bg-signal/10 px-2 py-0.5 font-mono text-[11px] text-signal-deep">Necesaria</span></span>
                El tema visual que eliges (claro u oscuro).
              </DefRow>
              <DefRow term={<Mono>doclab-onboarded-v1</Mono>}>
                <span className="mb-1 block"><span className="rounded-full bg-ember/10 px-2 py-0.5 font-mono text-[11px] text-ember">Preferencia</span></span>
                Si ya viste la bienvenida, para no repetírtela. Solo se guarda si aceptas las preferencias opcionales.
              </DefRow>
              <DefRow term={<Mono>doclab-signatures</Mono>}>
                <span className="mb-1 block"><span className="rounded-full bg-ember/10 px-2 py-0.5 font-mono text-[11px] text-ember">Funcional</span></span>
                Firmas que guardas voluntariamente en la herramienta de firma, para reutilizarlas. Nunca salen de tu equipo.
              </DefRow>
            </dl>
          </div>
          <p className="text-sm">
            Ninguna de estas entradas te identifica ni se comparte. No hay <Mono>Google Analytics</Mono>, ni píxeles, ni
            cookies publicitarias, ni huellas de navegador con fines de seguimiento.
          </p>
        </Section>

        <Section title="Gestionar tu elección">
          <p>Puedes cambiar tu decisión cuando quieras. También puedes borrar todo el almacenamiento local desde los ajustes de tu navegador.</p>
          <button
            type="button"
            onClick={openCookieSettings}
            className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            <SlidersHorizontal className="size-4" aria-hidden /> Configurar cookies
          </button>
        </Section>

        <Section title="Más contexto">
          <p className="text-sm">
            Este planteamiento es coherente con el resto del proyecto. Revisa{' '}
            <Link to="/privacidad" className="font-medium text-signal-deep hover:underline">Privacidad</Link> para saber
            qué datos tratamos, y{' '}
            <Link to="/seguridad" className="font-medium text-signal-deep hover:underline">Seguridad</Link> para el detalle técnico.
          </p>
          <p className="pt-2 font-mono text-xs text-graphite">Última actualización en {UPDATED}.</p>
        </Section>
      </Prose>
    </>
  );
}
