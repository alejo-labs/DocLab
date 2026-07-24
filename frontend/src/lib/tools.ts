import type { LucideIcon } from 'lucide-react';
import {
  Combine,
  Scissors,
  FileOutput,
  LayoutGrid,
  RotateCw,
  Trash2,
  Image,
  FileImage,
  Minimize2,
  FileText,
  FileSpreadsheet,
  Presentation,
  PenLine,
  Stamp,
  Hash,
  Tags,
  FileType,
  FormInput,
  ShieldCheck,
  Grid2x2,
  Lock,
  LockOpen,
  EyeOff,
  GitCompare,
  ScanText,
} from 'lucide-react';

/** Motor (componente) que ejecuta el trabajo. Varias tarjetas pueden reusar uno. */
export type EngineId =
  | 'merge'
  | 'split'
  | 'organize'
  | 'images-to-pdf'
  | 'pdf-to-images'
  | 'compress'
  | 'pdf-to-office'
  | 'edit'
  | 'watermark'
  | 'page-numbers'
  | 'metadata'
  | 'pdf-to-text'
  | 'forms'
  | 'excel-to-pdf'
  | 'sanitize'
  | 'nup'
  | 'protect'
  | 'unlock'
  | 'redact'
  | 'compare'
  | 'ocr';

/** Dónde se procesa el archivo. Determina el badge y el mensaje de privacidad. */
export type Processing = 'on-device' | 'ephemeral-server';

export type CategoryId = 'editar' | 'organizar' | 'optimizar' | 'seguridad' | 'convertir-a-pdf' | 'convertir-desde-pdf';

/** Configuración que una tarjeta inyecta en su motor para especializarlo. */
export interface ToolPreset {
  mode?: 'split' | 'extract';
  focus?: 'organize' | 'rotate' | 'delete';
  format?: 'jpg' | 'png';
  /** Extensiones aceptadas (herramientas de Office). */
  accept?: string[];
  /** Etiqueta del tipo de documento (p. ej. "Word"). */
  label?: string;
  /** Formato de salida para PDF→Office. */
  office?: 'docx' | 'pptx' | 'xlsx';
}

/** Tarjeta de utilidad del catálogo. */
export interface Tool {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly short: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly category: CategoryId;
  /** Sinónimos para el buscador local (te encuentra aunque no uses el nombre exacto). */
  readonly keywords: readonly string[];
  readonly engineId: EngineId;
  readonly preset?: ToolPreset;
  readonly processing: Processing;
  readonly available: boolean;
  /** 'wide' usa todo el ancho (editor/lienzo); por defecto, ancho de lectura. */
  readonly layout?: 'wide';
}

/**
 * Catálogo de tarjetas: una por utilidad clara (estilo iLovePDF). Varias reusan
 * el mismo `engineId` con un `preset` distinto.
 */
export const TOOLS: readonly Tool[] = [
  // ── Editar ──────────────────────────────────────────────────────────────────
  {
    id: 'editar-pdf',
    slug: 'editar-pdf',
    name: 'Editar PDF',
    short: 'Añade texto, dibujo, resaltado e imágenes.',
    description:
      'Anota y edita tu PDF: escribe texto, dibuja a mano, resalta, inserta imágenes y guárdalo. Todo en tu navegador.',
    icon: PenLine,
    category: 'editar',
    keywords: ['editar', 'anotar', 'escribir', 'dibujar', 'resaltar', 'firma', 'texto', 'edit'],
    engineId: 'edit',
    processing: 'on-device',
    available: true,
    layout: 'wide',
  },
  {
    id: 'formularios-pdf',
    slug: 'formularios-pdf',
    name: 'Formularios PDF',
    short: 'Rellena campos o diseña formularios.',
    description:
      'Rellena los campos de un formulario PDF (texto, casillas, desplegables) o diseña uno nuevo añadiendo campos sobre cualquier PDF. Todo en tu navegador.',
    icon: FormInput,
    category: 'editar',
    keywords: ['formulario', 'formularios', 'acroform', 'rellenar', 'campos', 'casilla', 'checkbox', 'diseñar', 'form', 'fill'],
    engineId: 'forms',
    processing: 'on-device',
    available: true,
    layout: 'wide',
  },
  {
    id: 'marca-de-agua',
    slug: 'marca-de-agua',
    name: 'Marca de agua',
    short: 'Estampa texto sobre todas las páginas.',
    description: 'Añade una marca de agua de texto (CONFIDENCIAL, BORRADOR…) con opacidad, color y rotación.',
    icon: Stamp,
    category: 'editar',
    keywords: ['marca', 'agua', 'watermark', 'sello', 'confidencial', 'borrador'],
    engineId: 'watermark',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'metadatos-pdf',
    slug: 'metadatos-pdf',
    name: 'Editar metadatos',
    short: 'Cambia título, autor y palabras clave.',
    description: 'Consulta y edita los metadatos del PDF: título, autor, asunto y palabras clave.',
    icon: Tags,
    category: 'editar',
    keywords: ['metadatos', 'metadata', 'titulo', 'autor', 'propiedades', 'palabras clave'],
    engineId: 'metadata',
    processing: 'on-device',
    available: true,
  },

  // ── Organizar ──────────────────────────────────────────────────────────────
  {
    id: 'unir-pdf',
    slug: 'unir-pdf',
    name: 'Unir PDF',
    short: 'Combina varios PDF en uno.',
    description: 'Une múltiples documentos PDF en un único archivo, en el orden que elijas.',
    icon: Combine,
    category: 'organizar',
    keywords: ['juntar', 'combinar', 'fusionar', 'unificar', 'merge', 'pegar'],
    engineId: 'merge',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'dividir-pdf',
    slug: 'dividir-pdf',
    name: 'Dividir PDF',
    short: 'Separa un PDF por páginas o rangos.',
    description: 'Divide un PDF en varios documentos seleccionando rangos o páginas individuales.',
    icon: Scissors,
    category: 'organizar',
    keywords: ['separar', 'partir', 'trocear', 'split', 'cortar'],
    engineId: 'split',
    preset: { mode: 'split' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'extraer-paginas',
    slug: 'extraer-paginas',
    name: 'Extraer páginas',
    short: 'Saca páginas concretas a un nuevo PDF.',
    description: 'Selecciona páginas sueltas o rangos y extráelos a un nuevo documento PDF.',
    icon: FileOutput,
    category: 'organizar',
    keywords: ['sacar', 'extraer', 'seleccionar', 'extract', 'paginas'],
    engineId: 'split',
    preset: { mode: 'extract' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'organizar-pdf',
    slug: 'organizar-pdf',
    name: 'Organizar páginas',
    short: 'Reordena las páginas arrastrando.',
    description: 'Reorganiza visualmente las páginas con arrastrar y soltar, rótalas o elimínalas.',
    icon: LayoutGrid,
    category: 'organizar',
    keywords: ['ordenar', 'reordenar', 'mover', 'organize', 'clasificar'],
    engineId: 'organize',
    preset: { focus: 'organize' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'rotar-pdf',
    slug: 'rotar-pdf',
    name: 'Rotar PDF',
    short: 'Gira las páginas que quieras.',
    description: 'Rota páginas individuales o todo el documento en incrementos de 90°.',
    icon: RotateCw,
    category: 'organizar',
    keywords: ['girar', 'rotacion', 'voltear', 'rotate', 'orientacion'],
    engineId: 'organize',
    preset: { focus: 'rotate' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'eliminar-paginas',
    slug: 'eliminar-paginas',
    name: 'Eliminar páginas',
    short: 'Quita las páginas que no necesitas.',
    description: 'Elimina páginas concretas de un PDF y descarga el documento resultante.',
    icon: Trash2,
    category: 'organizar',
    keywords: ['borrar', 'quitar', 'remove', 'delete', 'suprimir'],
    engineId: 'organize',
    preset: { focus: 'delete' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'numeros-de-pagina',
    slug: 'numeros-de-pagina',
    name: 'Números de página',
    short: 'Numera las páginas del documento.',
    description: 'Añade numeración a tu PDF: elige posición, formato (1/10, Página 1…) y número inicial.',
    icon: Hash,
    category: 'organizar',
    keywords: ['numeros', 'paginas', 'numerar', 'foliar', 'page numbers'],
    engineId: 'page-numbers',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'varias-por-hoja',
    slug: 'varias-paginas-por-hoja',
    name: 'Varias páginas por hoja',
    short: 'Imprime 2, 4, 6 o 9 páginas por hoja.',
    description: 'Coloca varias páginas del PDF en cada hoja (2, 4, 6 o 9) para ahorrar papel al imprimir. Todo en tu navegador.',
    icon: Grid2x2,
    category: 'organizar',
    keywords: ['n-up', 'nup', 'varias', 'por hoja', 'ahorro', 'papel', 'imprimir', 'multiple', 'cuadricula', 'miniaturas'],
    engineId: 'nup',
    processing: 'on-device',
    available: true,
  },

  // ── Optimizar ──────────────────────────────────────────────────────────────
  {
    id: 'comprimir-pdf',
    slug: 'comprimir-pdf',
    name: 'Comprimir PDF',
    short: 'Reduce el peso del archivo.',
    description: 'Optimiza y reduce el tamaño de tu PDF re-comprimiendo sus imágenes.',
    icon: Minimize2,
    category: 'optimizar',
    keywords: ['reducir', 'peso', 'optimizar', 'tamano', 'compress', 'achicar', 'ligero'],
    engineId: 'compress',
    processing: 'on-device',
    available: true,
  },

  // ── Seguridad ────────────────────────────────────────────────────────────────
  {
    id: 'proteger-pdf',
    slug: 'proteger-pdf',
    name: 'Proteger PDF',
    short: 'Cifra con contraseña (AES-256).',
    description:
      'Protege tu PDF con contraseña y permisos (impedir imprimir, copiar, editar). Cifrado AES-256, todo en tu navegador sin que el archivo salga del dispositivo.',
    icon: Lock,
    category: 'seguridad',
    keywords: ['proteger', 'contraseña', 'cifrar', 'encriptar', 'password', 'seguridad', 'aes', 'permisos', 'protect'],
    engineId: 'protect',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'desbloquear-pdf',
    slug: 'desbloquear-pdf',
    name: 'Desbloquear PDF',
    short: 'Quita la contraseña (si la conoces).',
    description:
      'Elimina la contraseña de un PDF protegido (necesitas conocerla). Todo en tu navegador, sin que el archivo salga del dispositivo.',
    icon: LockOpen,
    category: 'seguridad',
    keywords: ['desbloquear', 'quitar contraseña', 'descifrar', 'desproteger', 'unlock', 'remove password'],
    engineId: 'unlock',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'sanear-pdf',
    slug: 'sanear-pdf',
    name: 'Sanear PDF',
    short: 'Quita scripts, adjuntos y metadatos.',
    description:
      'Elimina JavaScript embebido, archivos adjuntos y metadatos (autor, software, rastro) de tu PDF. Todo en tu navegador, sin que el archivo salga del dispositivo.',
    icon: ShieldCheck,
    category: 'seguridad',
    keywords: ['sanear', 'sanitizar', 'seguridad', 'privacidad', 'limpiar', 'javascript', 'metadatos', 'adjuntos', 'sanitize'],
    engineId: 'sanitize',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'censurar-pdf',
    slug: 'censurar-pdf',
    name: 'Censurar PDF',
    short: 'Tapa información sensible de verdad.',
    description:
      'Oculta datos sensibles: la zona marcada se convierte en imagen negra y el texto debajo desaparece (no recuperable). Todo en tu navegador.',
    icon: EyeOff,
    category: 'seguridad',
    keywords: ['censurar', 'redactar', 'tachar', 'ocultar', 'tapar', 'redact', 'privacidad', 'sensible'],
    engineId: 'redact',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'comparar-pdf',
    slug: 'comparar-pdf',
    name: 'Comparar PDF',
    short: 'Resalta las diferencias de texto.',
    description:
      'Compara dos PDF y resalta los cambios de texto página a página (añadido, borrado). Todo en tu navegador.',
    icon: GitCompare,
    category: 'seguridad',
    keywords: ['comparar', 'diff', 'diferencias', 'cambios', 'versiones', 'compare', 'revisar'],
    engineId: 'compare',
    processing: 'on-device',
    available: true,
  },

  // ── Convertir a PDF ──────────────────────────────────────────────────────────
  {
    id: 'jpg-a-pdf',
    slug: 'jpg-a-pdf',
    name: 'JPG a PDF',
    short: 'Convierte imágenes en un PDF.',
    description: 'Crea un PDF a partir de imágenes JPG o PNG, ajustadas a tamaño de página estándar.',
    icon: Image,
    category: 'convertir-a-pdf',
    keywords: ['imagen', 'foto', 'jpg', 'jpeg', 'png', 'fotografia'],
    engineId: 'images-to-pdf',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'excel-a-pdf',
    slug: 'excel-a-pdf',
    name: 'Excel a PDF',
    short: 'Convierte hojas de cálculo a PDF.',
    description:
      'Convierte un Excel (.xlsx) en PDF conservando bordes, colores de celda, negritas y alineación. Todo en tu navegador.',
    icon: FileSpreadsheet,
    category: 'convertir-a-pdf',
    keywords: ['excel a pdf', 'xlsx', 'hoja', 'calculo', 'tabla', 'convertir', 'spreadsheet'],
    engineId: 'excel-to-pdf',
    processing: 'on-device',
    available: false,
  },

  // ── Convertir desde PDF ──────────────────────────────────────────────────────
  {
    id: 'pdf-a-word',
    slug: 'pdf-a-word',
    name: 'PDF a Word',
    short: 'PDF a documento Word editable.',
    description: 'Convierte un PDF en un documento Word (.docx) con el texto editable, 100% en tu navegador.',
    icon: FileText,
    category: 'convertir-desde-pdf',
    keywords: ['pdf a word', 'word', 'docx', 'editable', 'documento', 'convertir'],
    engineId: 'pdf-to-office',
    preset: { office: 'docx' },
    processing: 'on-device',
    available: false,
  },
  {
    id: 'pdf-a-powerpoint',
    slug: 'pdf-a-powerpoint',
    name: 'PDF a PowerPoint',
    short: 'PDF a presentación (1 página/diapositiva).',
    description: 'Convierte un PDF en una presentación PowerPoint (.pptx), una diapositiva por página, en tu navegador.',
    icon: Presentation,
    category: 'convertir-desde-pdf',
    keywords: ['pdf a powerpoint', 'powerpoint', 'pptx', 'presentacion', 'diapositivas', 'convertir'],
    engineId: 'pdf-to-office',
    preset: { office: 'pptx' },
    processing: 'on-device',
    available: false,
  },
  {
    id: 'pdf-a-excel',
    slug: 'pdf-a-excel',
    name: 'PDF a Excel',
    short: 'PDF a hoja de cálculo.',
    description: 'Convierte el texto de un PDF en una hoja de cálculo Excel (.xlsx) con filas y celdas, en tu navegador.',
    icon: FileSpreadsheet,
    category: 'convertir-desde-pdf',
    keywords: ['pdf a excel', 'excel', 'xlsx', 'hoja', 'calculo', 'tabla', 'convertir'],
    engineId: 'pdf-to-office',
    preset: { office: 'xlsx' },
    processing: 'on-device',
    available: false,
  },

  {
    id: 'pdf-a-jpg',
    slug: 'pdf-a-jpg',
    name: 'PDF a JPG',
    short: 'Cada página como imagen JPG.',
    description: 'Convierte las páginas de un PDF en imágenes JPG de alta fidelidad.',
    icon: FileImage,
    category: 'convertir-desde-pdf',
    keywords: ['imagen', 'jpg', 'jpeg', 'exportar', 'foto', 'rasterizar'],
    engineId: 'pdf-to-images',
    preset: { format: 'jpg' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'pdf-a-png',
    slug: 'pdf-a-png',
    name: 'PDF a PNG',
    short: 'Cada página como imagen PNG.',
    description: 'Convierte las páginas de un PDF en imágenes PNG sin pérdidas.',
    icon: FileImage,
    category: 'convertir-desde-pdf',
    keywords: ['imagen', 'png', 'exportar', 'transparencia', 'rasterizar'],
    engineId: 'pdf-to-images',
    preset: { format: 'png' },
    processing: 'on-device',
    available: true,
  },
  {
    id: 'ocr-pdf',
    slug: 'ocr-pdf',
    name: 'OCR (PDF buscable)',
    short: 'Reconoce el texto de escaneados.',
    description:
      'Aplica OCR a un PDF escaneado para reconocer su texto y hacerlo buscable y copiable (+ exportar a .txt). 100% en tu navegador con tesseract.js, sin que el archivo salga del dispositivo.',
    icon: ScanText,
    category: 'convertir-desde-pdf',
    keywords: ['ocr', 'escaneado', 'reconocer', 'texto', 'buscable', 'scan', 'tesseract', 'digitalizar'],
    engineId: 'ocr',
    processing: 'on-device',
    available: true,
  },
  {
    id: 'pdf-a-texto',
    slug: 'pdf-a-texto',
    name: 'PDF a Texto',
    short: 'Extrae todo el texto del PDF.',
    description: 'Extrae el texto de tu PDF para copiarlo o descargarlo como .txt. Todo en tu navegador.',
    icon: FileType,
    category: 'convertir-desde-pdf',
    keywords: ['texto', 'text', 'extraer', 'copiar', 'txt', 'contenido'],
    engineId: 'pdf-to-text',
    processing: 'on-device',
    available: true,
  },
] as const;

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getToolsByCategory(category: CategoryId): Tool[] {
  const inCat = TOOLS.filter((tool) => tool.category === category);
  // Las herramientas "en desarrollo" (available:false) se agrupan al final de su categoría,
  // sin alterar el orden relativo dentro de cada grupo (concatenación estable).
  return [...inCat.filter((t) => t.available), ...inCat.filter((t) => !t.available)];
}
