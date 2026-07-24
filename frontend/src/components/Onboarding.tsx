import { useEffect, useState } from 'react';
import { FlaskConical, ShieldCheck, Sparkles, X, type LucideIcon } from 'lucide-react';

const KEY = 'doclab-onboarded-v1';

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}
const STEPS: Step[] = [
  {
    icon: FlaskConical,
    title: 'Bienvenido a DocLab',
    body: 'Tu laboratorio de PDF: edita, convierte y organiza documentos con precisión de instrumento, directo desde el navegador.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidad por diseño',
    body: 'Tus archivos se procesan 100% en tu dispositivo y no se suben a ningún servidor. La única excepción (convertir Office) usa un contenedor efímero que no retiene nada.',
  },
  {
    icon: Sparkles,
    title: 'Todo en uno',
    body: 'Editor tipo Canva, unir/dividir, comprimir, marcas de agua, numeración, conversión de imágenes y Office, y búsqueda con IA. Arrastra un PDF a cualquier parte para empezar.',
  },
];

/** Onboarding de primera visita: 3 pasos, se muestra una sola vez (localStorage). */
export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* localStorage no disponible: no molestamos */
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  const s = STEPS[step]!;
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" onClick={close}>
      <div className="doclab-processing-in w-full max-w-md rounded-[var(--radius-instrument)] border border-line bg-paper-raised p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex justify-end">
          <button type="button" onClick={close} className="text-graphite hover:text-ink" aria-label="Cerrar"><X className="size-5" /></button>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-[12px] border border-line bg-paper text-signal-deep">
            <Icon className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-2xl font-700 tracking-tight text-ink">{s.title}</h2>
          <p className="mt-2 text-graphite">{s.body}</p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-signal-deep' : 'w-1.5 bg-line'}`} />
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="text-sm text-graphite hover:text-ink">Saltar</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((v) => v - 1)} className="rounded-[var(--radius-instrument)] border border-line px-4 py-2 text-sm text-ink hover:border-signal/50">Atrás</button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : setStep((v) => v + 1))}
              className="rounded-[var(--radius-instrument)] bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-soft"
            >
              {last ? 'Empezar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
