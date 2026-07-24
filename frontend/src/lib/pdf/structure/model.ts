/**
 * Modelo de documento estructurado: el resultado del análisis de layout de un PDF.
 * Todas las coordenadas en PUNTOS de página, origen ARRIBA-IZQUIERDA (y hacia abajo),
 * para que sea intuitivo y coherente con el editor. Lo consumen los conversores a Office.
 */

export interface Span {
  text: string;
  x: number;
  y: number; // top de la caja del glifo
  w: number;
  h: number; // ≈ tamaño de fuente
  fontSize: number;
  bold: boolean;
  italic: boolean;
  fontFamily: string;
  color?: string; // hex #rrggbb (best-effort)
}

export interface Line {
  spans: Span[];
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number; // tamaño dominante de la línea
  bold: boolean;
  italic: boolean;
  color?: string; // hex dominante
  fontFamily?: string; // familia dominante
}

export interface TableModel {
  /** filas → celdas (texto). Todas las filas tienen el mismo nº de columnas. */
  rows: string[][];
  cols: number;
  /** ancho de cada columna en puntos (para reproducirlo en Word/Excel). */
  colWidths?: number[];
  /** ¿la tabla original tenía líneas dibujadas? (lattice=true, sin bordes=false). */
  bordered?: boolean;
}

/** Atributos de maquetación de párrafo (todo en puntos salvo lineSpacing = ratio). */
export interface ParaAttrs {
  align?: 'left' | 'center' | 'right' | 'justify';
  indentFirst?: number;
  indentLeft?: number;
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface ImageModel {
  bytes: Uint8Array;
  mime: 'image/png' | 'image/jpeg';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Block =
  | ({ kind: 'heading'; level: number; lines: Line[] } & Rect & ParaAttrs)
  | ({ kind: 'paragraph'; lines: Line[] } & Rect & ParaAttrs)
  | ({ kind: 'list'; items: Line[]; ordered: boolean } & Rect & ParaAttrs)
  | ({ kind: 'table'; table: TableModel } & Rect & { spaceBefore?: number; spaceAfter?: number })
  | ({ kind: 'image'; image: ImageModel; align?: 'left' | 'center' | 'right' } & Rect & { spaceBefore?: number; spaceAfter?: number });

export interface Page {
  width: number;
  height: number;
  /** caja de contenido (márgenes) en puntos. */
  margin?: { left: number; top: number; right: number; bottom: number };
  blocks: Block[]; // en orden de lectura
}

export interface DocModel {
  pages: Page[];
  /** Líneas de encabezado/pie repetidas en la mayoría de páginas (van a Header/Footer en Word). */
  header?: Line[];
  footer?: Line[];
}

/** Segmento de línea vectorial (para detectar tablas con bordes). Coords top-left. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
