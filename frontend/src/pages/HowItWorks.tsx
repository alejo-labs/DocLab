import { Link } from 'react-router-dom';
import { Cpu, FileDown, ShieldCheck, Wand2, WifiOff, Boxes, ScanText, Lock, ArrowRight } from 'lucide-react';
import { PageHero, Prose, Section, FeatureCard, Mono } from '../components/page-kit';
import { usePageMeta } from '../lib/usePageMeta';

const flow = [
  { n: '01', title: 'Sueltas el archivo', body: 'El PDF (o imagen u Office) se lee en memoria del navegador con la API FileReader. No hay ninguna subida y nada viaja por la red.' },
  { n: '02', title: 'El motor corre en tu equipo', body: 'WebAssembly y JavaScript hacen el trabajo pesado (cifrar, comprimir, OCR, convertir) dentro de la pestaña, usando la CPU de tu dispositivo.' },
  { n: '03', title: 'Descargas el resultado', body: 'El archivo generado se ofrece como descarga local. Al cerrar la pestaña no queda ni rastro, sin copias y sin servidor.' },
];

const engines = [
  { icon: FileDown, title: 'pdf-lib', body: 'Crear, unir, dividir, rotar, numerar, poner marcas de agua y rellenar formularios PDF. Todo con manipulación directa del árbol de objetos del PDF.' },
  { icon: Cpu, title: 'pdf.js', body: 'El motor de Mozilla que renderiza cada página a un canvas para previsualizar, extraer texto y rasterizar cuando hace falta.' },
  { icon: Lock, title: 'qpdf-wasm', body: 'Cifrado y descifrado AES-256 y gestión de permisos, compilado a WebAssembly. Corre en un Web Worker para no bloquear la interfaz.' },
  { icon: ScanText, title: 'tesseract.js', body: 'Reconocimiento óptico de caracteres (OCR) para hacer buscables los PDF escaneados. El modelo de idioma se descarga una vez y se cachea.' },
  { icon: Boxes, title: 'fflate, docx y pptx', body: 'Compresión ZIP y generación de documentos Office (Word y PowerPoint) para las conversiones desde PDF, también en el cliente.' },
  { icon: Wand2, title: 'Motor de estructura', body: 'Un pipeline propio que reconstruye la maquetación (de textos a líneas, bloques y tablas) para pasar de PDF a Word con dos modos, fiel o texto limpio.' },
];

export function HowItWorks() {
  usePageMeta(
    'Cómo funciona · DocLab',
    'DocLab procesa tus PDF en el navegador con WebAssembly, sin subidas ni servidores. Los motores (pdf-lib, pdf.js, qpdf, tesseract) y el porqué del enfoque local-first.',
  );
  return (
    <>
      <PageHero
        kicker="Cómo funciona"
        title={<>Herramientas de PDF que <span className="text-signal-deep">no tocan la red</span></>}
        lead="DocLab traslada al navegador todo lo que otras webs hacen en sus servidores. Tu documento se procesa en tu propio dispositivo, con WebAssembly, y no sale de él."
      />

      <Prose>
        {/* Flujo en 3 pasos */}
        <Section title="El recorrido de un archivo">
          <div className="grid gap-4 sm:grid-cols-3">
            {flow.map((s) => (
              <div key={s.n} className="rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5">
                <span className="font-mono text-2xl font-700 text-signal-deep">{s.n}</span>
                <h3 className="mt-2 font-display text-lg font-600 text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm text-graphite">{s.body}</p>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 rounded-[var(--radius-instrument)] border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal-deep">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            Puedes comprobarlo tú mismo. Abre las herramientas de red del navegador (la pestaña «Network»), procesa un archivo y verás que no se envía nada. Incluso funciona sin conexión una vez cargada la página.
          </p>
        </Section>

        {/* Por qué en el navegador */}
        <Section title="¿Por qué en el navegador?">
          <p>
            El modelo clásico (subir tu documento a un servidor, procesarlo allí y devolvértelo) obliga a confiar en que
            ese servidor no guarda copias, no lo indexa y lo borra de verdad. DocLab quita esa confianza de la
            ecuación. Si el archivo <strong>nunca sale de tu equipo</strong>, no hay nada que prometer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={ShieldCheck} title="Privacidad estructural">
              No es una política, es arquitectura. Lo que no se transmite no se puede filtrar, vender ni requisar.
            </FeatureCard>
            <FeatureCard icon={WifiOff} title="Funciona sin conexión">
              Los motores viven en la propia pestaña. Tras la primera carga, muchas herramientas funcionan sin internet.
            </FeatureCard>
          </div>
        </Section>

        {/* Motores */}
        <Section title="Los motores bajo el capó">
          <p>
            Cada herramienta se apoya en librerías de código abierto con licencias permisivas (MIT, Apache, ISC),
            <strong> autoalojadas</strong> en nuestro propio dominio para no depender de CDNs de terceros que pudieran
            observar tu actividad. Se cargan de forma diferida, así que solo bajas el motor de la herramienta que abres.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {engines.map((e) => (
              <FeatureCard key={e.title} icon={e.icon} title={e.title}>{e.body}</FeatureCard>
            ))}
          </div>
        </Section>

        {/* La única excepción */}
        <Section title="La única excepción, la búsqueda con IA">
          <p>
            Hay una sola función que habla con un servidor, el <strong>buscador con IA</strong> que te ayuda a encontrar
            la herramienta adecuada describiendo lo que necesitas. En ese caso viaja <strong>solo tu frase de búsqueda</strong>
            {' '}y el catálogo público de herramientas, <strong>nunca ningún archivo</strong>. Es opcional y está claramente
            separado del procesamiento de documentos.
          </p>
        </Section>

        {/* Stack */}
        <Section title="Construido con">
          <p className="text-sm">
            React 19, TypeScript, Vite y Tailwind CSS v4 en el frontend. Un backend mínimo en Express (solo el proxy
            de búsqueda) endurecido con <Mono>helmet</Mono>, validación <Mono>zod</Mono> y limitación de peticiones.
            Servido tras Nginx con una <Mono>Content-Security-Policy</Mono> estricta. Tienes todo el detalle en la página de{' '}
            <Link to="/seguridad" className="font-medium text-signal-deep hover:underline">Seguridad</Link>.
          </p>
          <div className="pt-2">
            <Link
              to="/seguridad"
              className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              Ver el modelo de seguridad <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Section>
      </Prose>
    </>
  );
}
