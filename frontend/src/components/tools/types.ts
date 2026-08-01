import type { ToolPreset } from '../../lib/tools';

/** Bytes producidos por un motor, listos para previsualizar/encadenar. */
export interface ToolResult {
  bytes: Uint8Array;
  filename: string;
}

/** Props comunes a todos los motores de herramienta. */
export interface ToolEngineProps {
  preset?: ToolPreset;
}
