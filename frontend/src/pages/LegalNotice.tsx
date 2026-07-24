import { Link } from 'react-router-dom';
import { PageHero, Prose, Section } from '../components/page-kit';
import { usePageMeta } from '../lib/usePageMeta';

const UPDATED = 'julio de 2026';

export function LegalNotice() {
  usePageMeta(
    'Aviso legal · DocLab',
    'Condiciones de uso de DocLab: herramienta gratuita ofrecida «tal cual», con procesamiento en tu dispositivo. Uso aceptable, propiedad intelectual y responsabilidad.',
  );
  return (
    <>
      <PageHero
        kicker="Aviso legal"
        title="Condiciones de uso"
        lead="Las reglas básicas para usar DocLab. En resumen: es una herramienta gratuita, se ofrece «tal cual» y tus archivos son solo tuyos."
      />

      <Prose>
        <Section title="Titular y objeto">
          <p>
            DocLab es un proyecto personal y de demostración técnica, sin ánimo de lucro, que ofrece herramientas para
            trabajar con documentos PDF directamente en el navegador. El acceso y uso del sitio implica la aceptación de
            estas condiciones. Para contacto, usa las incidencias del{' '}
            <a href="https://github.com/alejo-labs/DocLab" target="_blank" rel="noreferrer noopener" className="font-medium text-signal-deep hover:underline">repositorio público</a>.
          </p>
        </Section>

        <Section title="Uso aceptable">
          <p>Te comprometes a usar DocLab conforme a la ley y a no emplearlo para:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>procesar documentos sobre los que no tengas derechos o autorización;</li>
            <li>vulnerar derechos de terceros (propiedad intelectual, privacidad, etc.);</li>
            <li>intentar dañar, sobrecargar o comprometer el servicio o su infraestructura.</li>
          </ul>
          <p>Eres responsable del contenido de los archivos que procesas, que en todo caso permanecen en tu dispositivo.</p>
        </Section>

        <Section title="Propiedad intelectual">
          <p>
            El código de DocLab es abierto y está disponible en su repositorio bajo la licencia allí indicada. Las
            librerías de terceros que utiliza conservan sus respectivas licencias (MIT, Apache-2.0, ISC). Las marcas o
            nombres de terceros que puedan mencionarse pertenecen a sus titulares y se citan solo con fines
            identificativos o comparativos.
          </p>
        </Section>

        <Section title="Ausencia de garantías">
          <p>
            El servicio se ofrece <strong>«tal cual» y «según disponibilidad»</strong>, sin garantías de ningún tipo. Aunque
            se cuida la calidad, ninguna herramienta de documentos es infalible: el OCR puede contener errores, algunas
            conversiones son aproximadas y ciertas funciones figuran como «en desarrollo». Debes verificar los resultados
            antes de darles un uso crítico y conservar copias de tus archivos originales.
          </p>
        </Section>

        <Section title="Limitación de responsabilidad">
          <p>
            En la medida permitida por la ley, no se asume responsabilidad por daños directos o indirectos derivados del
            uso o la imposibilidad de uso del servicio, incluida la pérdida de datos. Dado que el procesamiento ocurre en
            tu propio dispositivo, la custodia de tus documentos es tuya.
          </p>
        </Section>

        <Section title="Legislación aplicable">
          <p>
            Estas condiciones se rigen por la legislación española y de la Unión Europea. Para el tratamiento de datos,
            consulta la <Link to="/privacidad" className="font-medium text-signal-deep hover:underline">Política de privacidad</Link> y la
            política de <Link to="/cookies" className="font-medium text-signal-deep hover:underline">Cookies</Link>.
          </p>
          <p className="pt-2 font-mono text-xs text-graphite">Última actualización: {UPDATED}.</p>
        </Section>
      </Prose>
    </>
  );
}
