import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { EngineId } from '../../lib/tools';
import type { ToolEngineProps } from './types';

type Engine = LazyExoticComponent<ComponentType<ToolEngineProps>>;

/**
 * Mapa engineId → componente del motor, cargado de forma diferida (code-splitting).
 * Las librerías pesadas (pdf.js, pdf-lib) solo se descargan al abrir una herramienta.
 * Varias tarjetas del catálogo reusan el mismo motor con distinto `preset`.
 */
export const TOOL_COMPONENTS: Record<EngineId, Engine> = {
  merge: lazy(() => import('./MergeTool').then((m) => ({ default: m.MergeTool }))),
  split: lazy(() => import('./SplitTool').then((m) => ({ default: m.SplitTool }))),
  organize: lazy(() => import('./OrganizeTool').then((m) => ({ default: m.OrganizeTool }))),
  'images-to-pdf': lazy(() => import('./ImagesToPdfTool').then((m) => ({ default: m.ImagesToPdfTool }))),
  'pdf-to-images': lazy(() => import('./PdfToImagesTool').then((m) => ({ default: m.PdfToImagesTool }))),
  compress: lazy(() => import('./CompressTool').then((m) => ({ default: m.CompressTool }))),
  'pdf-to-office': lazy(() => import('./PdfToOfficeTool').then((m) => ({ default: m.PdfToOfficeTool }))),
  edit: lazy(() => import('./EditorTool').then((m) => ({ default: m.EditorTool }))),
  watermark: lazy(() => import('./WatermarkTool').then((m) => ({ default: m.WatermarkTool }))),
  'page-numbers': lazy(() => import('./PageNumbersTool').then((m) => ({ default: m.PageNumbersTool }))),
  metadata: lazy(() => import('./MetadataTool').then((m) => ({ default: m.MetadataTool }))),
  'pdf-to-text': lazy(() => import('./PdfToTextTool').then((m) => ({ default: m.PdfToTextTool }))),
  forms: lazy(() => import('./FormsTool').then((m) => ({ default: m.FormsTool }))),
  'excel-to-pdf': lazy(() => import('./ExcelToPdfTool').then((m) => ({ default: m.ExcelToPdfTool }))),
  sanitize: lazy(() => import('./SanitizeTool').then((m) => ({ default: m.SanitizeTool }))),
  nup: lazy(() => import('./NupTool').then((m) => ({ default: m.NupTool }))),
  protect: lazy(() => import('./ProtectTool').then((m) => ({ default: m.ProtectTool }))),
  unlock: lazy(() => import('./UnlockTool').then((m) => ({ default: m.UnlockTool }))),
  redact: lazy(() => import('./RedactTool').then((m) => ({ default: m.RedactTool }))),
  compare: lazy(() => import('./CompareTool').then((m) => ({ default: m.CompareTool }))),
  ocr: lazy(() => import('./OcrTool').then((m) => ({ default: m.OcrTool }))),
};
