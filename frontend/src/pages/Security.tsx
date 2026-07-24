import { Link } from 'react-router-dom';
import { Lock, ServerCog, PackageCheck, EyeOff, FileWarning, KeyRound } from 'lucide-react';
import { PageHero, Prose, Section, FeatureCard, DefRow, Mono } from '../components/page-kit';

const headers: { name: string; value: string; why: string }[] = [
  { name: 'Content-Security-Policy', value: "script-src 'self' 'wasm-unsafe-eval'", why: 'Solo se ejecuta código de nuestro propio dominio. Sin scripts en línea ni de terceros.' },
  { name: 'default-src', value: "'self'", why: 'Todo (imágenes, fuentes, conexiones) parte del mismo origen; nada externo por defecto.' },
  { name: 'object-src / base-uri', value: "'none'", why: 'Bloquea plugins embebidos y la manipulación de la URL base — vectores clásicos de inyección.' },
  { name: 'frame-ancestors', value: "'none'", why: 'La página no puede incrustarse en un iframe: protege frente a clickjacking.' },
  { name: 'X-Content-Type-Options', value: 'nosniff', why: 'El navegador no «adivina» tipos MIME; evita que un recurso se ejecute como algo que no es.' },
  { name: 'Cross-Origin-Opener/Resource-Policy', value: 'same-origin', why: 'Aísla la pestaña de otros orígenes y evita fugas por canales laterales.' },
];

export function Security() {
  return (
    <>
      <PageHero
        kicker="Seguridad"
        title={<>Seguridad por <span className="text-signal-deep">arquitectura</span>, no por promesa</>}
        lead="La forma más fiable de proteger un documento es no moverlo. Sobre esa base, endurecemos cada capa que queda."
      />

      <Prose>
        <Section title="Modelo de amenazas, en corto">
          <p>
            La pregunta de partida no es «¿cómo protegemos tu archivo en nuestro servidor?», sino «¿cómo evitamos que
            llegue a un servidor?». Al procesar en el dispositivo, desaparecen de golpe categorías enteras de riesgo:
            filtraciones del servidor, copias residuales, accesos indebidos, requerimientos a terceros o inspección en
            tránsito. Lo que no existe no se puede comprometer.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={EyeOff} title="Sin cuentas ni perfiles">
              No hay registro, ni login, ni identificadores de usuario. No sabemos quién eres ni qué documentos abres.
            </FeatureCard>
            <FeatureCard icon={FileWarning} title="Sin retención">
              Tus archivos no se escriben en disco ni en base de datos. El backend ni siquiera recibe documentos.
            </FeatureCard>
          </div>
        </Section>

        <Section title="WebAssembly en un entorno aislado">
          <p>
            El cifrado (qpdf), el OCR (tesseract) y la compresión corren como <strong>WebAssembly</strong> dentro del
            sandbox del navegador: sin acceso al sistema de archivos, sin red, sin más permisos que los de la pestaña.
            Los binarios <Mono>.wasm</Mono> se <strong>sirven desde nuestro propio dominio</strong> (no desde CDNs) para
            que la CSP <Mono>'self'</Mono> los cubra y nadie más observe qué haces.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={Lock} title="Cifrado AES-256">
              Proteger con contraseña usa cifrado estándar AES-256 vía qpdf, ejecutado en un Web Worker para no congelar
              la interfaz, con reserva al hilo principal si el worker no está disponible.
            </FeatureCard>
            <FeatureCard icon={KeyRound} title="'wasm-unsafe-eval', no 'unsafe-eval'">
              La CSP permite compilar nuestro propio WebAssembly, pero <strong>no</strong> habilita <Mono>eval()</Mono> de
              JavaScript. Es un permiso acotado y seguro, no una puerta abierta.
            </FeatureCard>
          </div>
        </Section>

        <Section title="Cabeceras de seguridad">
          <p>El frontend se sirve tras Nginx con una batería de cabeceras que se aplican también a los recursos con hash (JS/WASM):</p>
          <div className="overflow-hidden rounded-[var(--radius-instrument)] border border-line bg-paper-raised">
            <dl className="px-5">
              {headers.map((h) => (
                <DefRow key={h.name} term={<Mono>{h.name}</Mono>}>
                  <span className="block font-mono text-xs text-signal-deep">{h.value}</span>
                  <span className="mt-1 block">{h.why}</span>
                </DefRow>
              ))}
            </dl>
          </div>
        </Section>

        <Section title="El backend, reducido al mínimo">
          <p>
            La única pieza de servidor es un proxy para la búsqueda con IA. Está endurecido y <strong>nunca toca tus
            documentos</strong>:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard icon={ServerCog} title="Superficie mínima">
              Sin subida de archivos, sin escritura a disco. Cabeceras <Mono>helmet</Mono>, CORS por lista blanca,
              limitación de peticiones y validación estricta de entrada con <Mono>zod</Mono>.
            </FeatureCard>
            <FeatureCard icon={PackageCheck} title="0 vulnerabilidades conocidas">
              <Mono>npm audit</Mono> en verde (front y back). Dependabot vigila las dependencias y un flujo de CI ejecuta
              tipos, lint, tests y build en cada cambio.
            </FeatureCard>
          </div>
        </Section>

        <Section title="Prácticas de código">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sin <Mono>dangerouslySetInnerHTML</Mono> en toda la aplicación: no hay superficie de XSS por inyección de HTML.</li>
            <li>TypeScript estricto + <Mono>oxlint</Mono> a cero avisos; 51 tests de lógica pura que blindan las funciones críticas.</li>
            <li>Dependencias solo con licencias permisivas (MIT/Apache/ISC); nada copyleft que comprometa el proyecto.</li>
            <li>Assets de terceros (fuentes, motores) <strong>autoalojados</strong>: cero peticiones a dominios ajenos.</li>
          </ul>
        </Section>

        <Section title="Honestidad sobre los límites">
          <p>
            Ninguna herramienta es infalible. El OCR puede equivocarse en escaneos de baja calidad; la reconstrucción
            de PDF→Word de documentos muy complejos es aproximada; y «censurar» rasteriza para eliminar de verdad el
            texto tapado. Lo decimos claro dentro de cada herramienta. Si encuentras un fallo de seguridad, cuéntanoslo
            a través del <a href="https://github.com/alejo-labs/DocLab" target="_blank" rel="noreferrer noopener" className="font-medium text-signal-deep hover:underline">repositorio</a>.
          </p>
          <p className="text-sm">
            ¿Quieres el detalle de qué datos se guardan (y cuáles no)? Está en{' '}
            <Link to="/privacidad" className="font-medium text-signal-deep hover:underline">Privacidad</Link> y{' '}
            <Link to="/cookies" className="font-medium text-signal-deep hover:underline">Cookies</Link>.
          </p>
        </Section>
      </Prose>
    </>
  );
}
