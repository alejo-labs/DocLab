import { Link } from 'react-router-dom';
import { ShieldCheck, Trash2, Lock, Sparkles } from 'lucide-react';
import { PageHero, Prose, Section, FeatureCard } from '../components/page-kit';
import { usePageMeta } from '../lib/usePageMeta';

const UPDATED = 'julio de 2026';

export function Privacy() {
  usePageMeta(
    'Privacidad · DocLab',
    'Política de privacidad de DocLab según el RGPD y la LOPDGDD. Tus documentos se procesan en tu dispositivo y no se suben. Sin cuentas, sin seguimiento y sin retención.',
  );
  return (
    <>
      <PageHero
        kicker="Cómo protegemos tus datos"
        title={<>Privacidad <span className="text-signal-deep">por diseño</span></>}
        lead="DocLab parte de un principio de confianza cero. Tus documentos son tuyos y no tienen por qué pasar por ningún servidor."
      />

      <Prose>
        {/* Resumen visual */}
        <Section title="En una frase">
          <p>
            El contenido de tus archivos <strong>se procesa en tu dispositivo y nunca se sube</strong>. No hay cuentas,
            no hay seguimiento y no guardamos tus documentos. La única función que usa un servidor es la búsqueda con IA,
            y a ella solo viaja tu frase de búsqueda, jamás un archivo.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={ShieldCheck} title="Procesamiento local">
              Unir, dividir, comprimir, cifrar, editar, OCR y convertir ocurren en tu navegador con WebAssembly. Esos archivos no se transmiten por la red.
            </FeatureCard>
            <FeatureCard icon={Trash2} title="Cero retención">
              No almacenamos tus documentos en disco ni en base de datos. No hay cuentas, ni perfiles, ni historial de archivos.
            </FeatureCard>
            <FeatureCard icon={Lock} title="Sin terceros observando">
              Fuentes y librerías se sirven desde el propio dominio. No cargamos recursos de CDNs externas.
            </FeatureCard>
            <FeatureCard icon={Sparkles} title="IA acotada y opcional">
              El buscador con IA solo recibe tu texto de búsqueda y el catálogo público de herramientas.
            </FeatureCard>
          </div>
        </Section>

        {/* Política formal */}
        <Section title="Responsable del tratamiento">
          <p>
            DocLab es un <strong>proyecto personal y de demostración técnica</strong>, sin ánimo de lucro. Para cualquier
            cuestión relativa a esta política o al ejercicio de tus derechos, puedes contactar a través de las incidencias
            del <a href="https://github.com/alejo-labs/DocLab" target="_blank" rel="noreferrer noopener" className="font-medium text-signal-deep hover:underline">repositorio público del proyecto</a>.
            Esta política se rige por el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).
          </p>
        </Section>

        <Section title="Qué datos tratamos (y cuáles no)">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Tus documentos e imágenes.</strong> <em>No</em> son datos que tratemos. Se abren y procesan
              localmente en tu navegador y no se envían a ningún servidor, no se almacenan y no se comparten.
            </li>
            <li>
              <strong>Búsqueda con IA (opcional).</strong> Si la usas, se envía únicamente tu <strong>frase de búsqueda</strong>
              {' '}y la lista pública de herramientas a un proveedor de IA para devolverte una sugerencia. No se envían archivos ni datos identificativos.
            </li>
            <li>
              <strong>Datos técnicos mínimos.</strong> Al solicitar la búsqueda con IA, el servidor puede procesar de forma
              <strong> transitoria</strong> tu dirección IP para aplicar límites de uso y prevenir abusos. No se usa para
              perfilarte ni se conserva con fines de seguimiento.
            </li>
            <li>
              <strong>Preferencias de interfaz.</strong> El tema (claro u oscuro), el aviso de bienvenida y tu elección de
              cookies se guardan <strong>en tu propio navegador</strong> (localStorage), no en un servidor. Tienes más detalle en{' '}
              <Link to="/cookies" className="font-medium text-signal-deep hover:underline">Cookies</Link>.
            </li>
          </ul>
        </Section>

        <Section title="Base jurídica">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Consentimiento</strong> (art. 6.1.a RGPD), para enviar tu frase a la búsqueda con IA, que solo se ejecuta cuando la usas activamente.</li>
            <li><strong>Interés legítimo</strong> (art. 6.1.f RGPD), para el tratamiento transitorio de la IP con fines de seguridad y prevención de abuso del servicio.</li>
          </ul>
        </Section>

        <Section title="Terceros y transferencias">
          <p>
            El procesamiento de tus documentos no implica a ningún tercero. En las dos funciones que sí usan red
            intervienen un <strong>proveedor de IA</strong> (que recibe únicamente el texto de búsqueda) y el
            <strong> proveedor de red y hosting</strong> que sirve la página. Estos proveedores pueden estar ubicados fuera
            del EEE. En ese caso, las transferencias se amparan en las garantías previstas por el RGPD, como las cláusulas
            contractuales tipo. No vendemos ni cedemos datos a terceros con fines comerciales.
          </p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Puedes ejercer los derechos de <strong>acceso, rectificación, supresión, oposición, limitación y
            portabilidad</strong>. Dado que no mantenemos cuentas ni almacenamos tus documentos ni un historial asociado
            a ti, en la práctica <strong>apenas conservamos datos personales que podamos identificar contigo</strong>.
            Para cualquier solicitud o reclamación, usa el canal de contacto indicado arriba. También puedes reclamar ante
            la Agencia Española de Protección de Datos (AEPD).
          </p>
        </Section>

        <Section title="Menores, cambios y vigencia">
          <p>
            El servicio no está dirigido específicamente a menores ni recopila datos de forma consciente sobre ellos.
            Podemos actualizar esta política para reflejar mejoras o cambios legales, y la versión vigente es siempre la
            publicada aquí.
          </p>
          <p className="pt-2 font-mono text-xs text-graphite">Última actualización en {UPDATED}.</p>
        </Section>
      </Prose>
    </>
  );
}
