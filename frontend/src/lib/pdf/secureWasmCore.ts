/**
 * Núcleo de qpdf-wasm compartido por el hilo principal y el Web Worker. Carga diferida
 * del módulo Emscripten + su `.wasm` (autoalojado por Vite `?url`, cumpliendo CSP `'self'`).
 * Los fallos de *carga* del motor se marcan con `infra: true` para que el despachador pueda
 * reintentar en el hilo principal; los errores de *proceso* (contraseña incorrecta, PDF
 * dañado) se propagan tal cual.
 */
interface QpdfFS { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array }
interface QpdfModule { FS: QpdfFS; callMain(args: string[]): number }
type CreateModule = (opts: Record<string, unknown>) => Promise<QpdfModule>;

/** Error de infraestructura (no se pudo cargar/instanciar el motor) → permite fallback. */
export class QpdfInfraError extends Error {
  readonly infra = true;
  constructor(message: string, options?: { cause?: unknown }) { super(message, options); this.name = 'QpdfInfraError'; }
}

let cached: Promise<{ create: CreateModule; wasmUrl: string }> | null = null;
function load() {
  if (!cached) {
    cached = (async () => {
      const [mod, url] = await Promise.all([
        import('@neslinesli93/qpdf-wasm'),
        import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'),
      ]);
      return { create: (mod.default as unknown) as CreateModule, wasmUrl: (url.default as unknown) as string };
    })();
  }
  return cached;
}

/** Ejecuta qpdf con args estilo CLI sobre `input`, devolviendo `/out.pdf`. */
export async function runQpdf(args: string[], input: Uint8Array): Promise<Uint8Array> {
  let create: CreateModule;
  let wasmUrl: string;
  try {
    ({ create, wasmUrl } = await load());
  } catch (e) {
    cached = null; // permite reintentar la carga más adelante
    throw new QpdfInfraError('No se pudo cargar el motor de seguridad (qpdf).', { cause: e });
  }

  let mod: QpdfModule;
  try {
    mod = await create({ locateFile: () => wasmUrl, noInitialRun: true, print: () => {}, printErr: () => {} });
  } catch (e) {
    throw new QpdfInfraError('No se pudo iniciar el motor de seguridad (qpdf).', { cause: e });
  }

  mod.FS.writeFile('/in.pdf', input);
  let code = 0;
  try { code = mod.callMain(args); } catch (e) { code = (e as { status?: number })?.status ?? -1; }
  let out: Uint8Array | null = null;
  try { out = mod.FS.readFile('/out.pdf'); } catch { out = null; }
  // qpdf: 0 = ok, 3 = warnings (salida válida). Otros = error.
  if (!out || !out.length || (code !== 0 && code !== 3)) throw new Error('qpdf no pudo procesar el PDF.');
  return out;
}
