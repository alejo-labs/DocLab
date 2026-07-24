import { ShieldCheck, Server, Trash2, Lock } from 'lucide-react';

const points = [
  {
    icon: ShieldCheck,
    title: 'Procesamiento local por defecto',
    body: 'Unir, dividir, organizar, comprimir y convertir imágenes ocurre íntegramente en tu navegador mediante WebAssembly y JavaScript. Esos archivos nunca se transmiten por la red.',
  },
  {
    icon: Server,
    title: 'Conversión de Office: efímera',
    body: 'La única tarea que requiere servidor es convertir Word/Excel/PowerPoint a PDF. Se procesa en un contenedor aislado, en memoria, y el archivo se descarta inmediatamente tras devolver el resultado.',
  },
  {
    icon: Trash2,
    title: 'Cero retención',
    body: 'No almacenamos tus documentos en disco ni en base de datos. No hay cuentas, ni perfiles, ni seguimiento de los archivos que procesas.',
  },
  {
    icon: Lock,
    title: 'Sin terceros',
    body: 'Tipografías y librerías se sirven desde el propio dominio. No cargamos recursos de CDNs externas que pudieran observar tu actividad.',
  },
];

export function Privacy() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-deep">
        Cómo protegemos tus datos
      </p>
      <h1 className="mt-3 font-display text-4xl font-700 tracking-tight text-ink">
        Privacidad por diseño
      </h1>
      <p className="mt-4 text-lg text-graphite">
        DocLab parte de un principio de confianza cero: tus documentos son tuyos y no tienen por qué
        pasar por nuestros servidores.
      </p>

      <div className="mt-10 space-y-5">
        {points.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="flex gap-4 rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-line bg-paper text-signal-deep">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-600 tracking-tight text-ink">{title}</h2>
              <p className="mt-1 text-sm text-graphite">{body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
