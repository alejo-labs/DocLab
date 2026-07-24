/**
 * Seguridad con qpdf-wasm (Apache/ISC, autoalojado, carga diferida). Cifrado AES-256,
 * descifrado y permisos — 100% en el navegador, sin que el archivo salga del dispositivo.
 * El .wasm se sirve desde el propio bundle (Vite `?url`), cumpliendo CSP `'self'`.
 *
 * El cómputo se descarga a un **Web Worker** (`secureWasm.worker.ts`) para no congelar la
 * interfaz con PDFs grandes. Si el worker no está disponible o no puede cargar el WASM, se
 * **recurre al hilo principal** de forma transparente: la funcionalidad no depende del worker.
 */
import { runQpdf as runQpdfMainThread } from './secureWasmCore';

interface WorkerResponse { id: number; ok: boolean; out?: Uint8Array; infra?: boolean; error?: string }

let worker: Worker | null = null;
let workerUnavailable = false;
let seq = 0;
const pending = new Map<number, { resolve: (u: Uint8Array) => void; reject: (e: unknown) => void }>();

/** Marca de "el worker no sirve" para que el despachador caiga al hilo principal. */
class WorkerInfraError extends Error {}

function failWorker(reason: string) {
  workerUnavailable = true;
  for (const p of pending.values()) p.reject(new WorkerInfraError(reason));
  pending.clear();
  try { worker?.terminate(); } catch { /* noop */ }
  worker = null;
}

function getWorker(): Worker | null {
  if (workerUnavailable) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./secureWasm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const { id, ok, out, infra, error } = ev.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok && out) p.resolve(out);
      else if (infra) p.reject(new WorkerInfraError(error ?? 'infra'));
      else p.reject(new Error(error ?? 'qpdf no pudo procesar el PDF.'));
    };
    worker.onerror = () => failWorker('el worker de seguridad no pudo cargar');
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/** Ejecuta qpdf en el worker; ante fallo de infraestructura, reintenta en el hilo principal. */
async function runQpdf(args: string[], input: Uint8Array): Promise<Uint8Array> {
  const w = getWorker();
  if (!w) return runQpdfMainThread(args, input);
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const id = (seq += 1);
      pending.set(id, { resolve, reject });
      const copy = input.slice(); // copia transferible: no neutraliza el buffer del llamador
      w.postMessage({ id, args, input: copy }, [copy.buffer]);
    });
  } catch (e) {
    // Solo los fallos de infraestructura del worker justifican rehacer el trabajo aquí;
    // un error de proceso (p. ej. contraseña incorrecta) se propaga sin duplicar cómputo.
    if (e instanceof WorkerInfraError) { workerUnavailable = true; return runQpdfMainThread(args, input); }
    throw e;
  }
}

/** Permisos del propietario (true = permitido). */
export interface PdfPermissions { print: boolean; copy: boolean; modify: boolean; annotate: boolean }

function restrictionArgs(p?: PdfPermissions): string[] {
  if (!p) return [];
  const a: string[] = [];
  if (!p.print) a.push('--print=none');
  if (!p.modify) a.push('--modify=none');
  if (!p.copy) a.push('--extract=n');
  if (!p.annotate) a.push('--annotate=n');
  return a;
}

/** Cifra con contraseña de usuario (abrir) y, opcionalmente, de propietario + permisos. AES-256. */
export async function protectPdf(bytes: Uint8Array, userPwd: string, ownerPwd?: string, perms?: PdfPermissions): Promise<Uint8Array> {
  const owner = ownerPwd && ownerPwd.length ? ownerPwd : userPwd;
  return runQpdf(['--encrypt', userPwd, owner, '256', ...restrictionArgs(perms), '--', '/in.pdf', '/out.pdf'], bytes);
}

/** Quita el cifrado dado la contraseña correcta. */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  return runQpdf([`--password=${password}`, '--decrypt', '/in.pdf', '/out.pdf'], bytes);
}

/** Aplica permisos (cifrado solo con contraseña de propietario; abrir sin contraseña). */
export async function setPdfPermissions(bytes: Uint8Array, ownerPwd: string, perms: PdfPermissions): Promise<Uint8Array> {
  return runQpdf(['--encrypt', '', ownerPwd, '256', ...restrictionArgs(perms), '--', '/in.pdf', '/out.pdf'], bytes);
}
