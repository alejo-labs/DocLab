import { Link } from 'react-router-dom';
import { Code2, Compass, Layers, HeartHandshake, ArrowRight } from 'lucide-react';
import { PageHero, Prose, Section, FeatureCard } from '../components/page-kit';
import { usePageMeta } from '../lib/usePageMeta';

const principles = [
  { icon: Compass, title: 'Privacidad primero', body: 'Cada decisión de diseño se toma a favor de tus datos. Si algo puede hacerse en el dispositivo, se hace en el dispositivo.' },
  { icon: Layers, title: 'Honestidad técnica', body: 'Preferimos decir «esto es aproximado» a fingir perfección. Las limitaciones se explican donde ocurren.' },
  { icon: HeartHandshake, title: 'Sin trampas', body: 'Sin muros de pago sorpresa, sin registro obligatorio, sin rastreadores. La herramienta trabaja para ti, no al revés.' },
];

export function About() {
  usePageMeta(
    'Sobre DocLab',
    'DocLab es un laboratorio de PDF local-first: un proyecto de demostración desarrollado con IA que prioriza la privacidad, la accesibilidad y la calidad de ingeniería.',
  );
  return (
    <>
      <PageHero
        kicker="Sobre DocLab"
        title={<>Un laboratorio de PDF <span className="text-signal-deep">local-first</span></>}
        lead="DocLab nace de una idea simple: las herramientas de documentos más usadas del mundo te piden subir tus archivos. ¿Y si no hiciera falta?"
      />

      <Prose>
        <Section title="La historia">
          <p>
            La mayoría de utilidades de PDF funcionan enviando tu documento a un servidor remoto. Es cómodo, pero
            significa que contratos, nóminas, informes médicos o DNIs pasan por máquinas que no controlas. DocLab
            demuestra que casi todo eso —unir, dividir, comprimir, cifrar, editar, reconocer texto, convertir— se puede
            hacer <strong>íntegramente en el navegador</strong>, con la misma comodidad y sin ceder tus archivos.
          </p>
          <p>
            Es un <strong>proyecto personal y de demostración técnica</strong>: un clon funcional y cuidado que prioriza
            la privacidad y la calidad de ingeniería por encima de perseguir cada función de las alternativas
            comerciales. Algunas herramientas de Office figuran como «en desarrollo» a propósito, para no prometer una
            fidelidad que no está lista.
          </p>
        </Section>

        <Section title="Principios">
          <div className="grid gap-4 sm:grid-cols-3">
            {principles.map((p) => (
              <FeatureCard key={p.title} icon={p.icon} title={p.title}>{p.body}</FeatureCard>
            ))}
          </div>
        </Section>

        <Section title="Cómo está hecho">
          <p>
            Frontend en React 19 + TypeScript + Vite + Tailwind CSS v4. El procesamiento se apoya en librerías de código
            abierto (pdf-lib, pdf.js, qpdf-wasm, tesseract.js, fflate…), todas autoalojadas. Un backend mínimo en Express
            sirve únicamente el buscador con IA. Puedes leer los detalles en{' '}
            <Link to="/como-funciona" className="font-medium text-signal-deep hover:underline">Cómo funciona</Link> y{' '}
            <Link to="/seguridad" className="font-medium text-signal-deep hover:underline">Seguridad</Link>.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="https://github.com/alejo-labs/DocLab"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              <Code2 className="size-4" aria-hidden /> Ver el código
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-[var(--radius-instrument)] border border-line bg-paper-raised px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-signal/50"
            >
              Probar las herramientas <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Section>
      </Prose>
    </>
  );
}
