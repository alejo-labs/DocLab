/**
 * Web Worker de seguridad (qpdf). Descarga el cifrado/descifrado AES-256 —que puede tardar
 * en PDFs grandes— fuera del hilo principal, evitando que la interfaz se congele. Si el
 * worker no puede cargar el WASM, informa `infra: true` y el hilo principal reintenta ahí.
 */
import { runQpdf, QpdfInfraError } from './secureWasmCore';

interface Req { id: number; args: string[]; input: Uint8Array }
interface WorkerCtx {
  onmessage: ((ev: MessageEvent<Req>) => void) | null;
  postMessage(msg: unknown, transfer?: Transferable[]): void;
}

const ctx = self as unknown as WorkerCtx;

ctx.onmessage = async (ev) => {
  const { id, args, input } = ev.data;
  try {
    const out = await runQpdf(args, input);
    ctx.postMessage({ id, ok: true, out }, [out.buffer]);
  } catch (e) {
    const infra = e instanceof QpdfInfraError;
    ctx.postMessage({ id, ok: false, infra, error: (e as Error)?.message ?? 'qpdf error' });
  }
};
