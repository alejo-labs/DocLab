import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, Gauge, FileInput, FileOutput, PenLine, ShieldCheck } from 'lucide-react';
import type { CategoryId } from './tools';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** Orden y metadatos de las categorías para el filtro y el agrupado de la home. */
export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: 'editar',
    label: 'Editar PDF',
    description: 'Anota, escribe y dibuja sobre tu documento.',
    icon: PenLine,
  },
  {
    id: 'organizar',
    label: 'Organizar PDF',
    description: 'Une, divide, reordena, rota o elimina páginas.',
    icon: LayoutGrid,
  },
  {
    id: 'optimizar',
    label: 'Optimizar PDF',
    description: 'Reduce el peso de tus documentos.',
    icon: Gauge,
  },
  {
    id: 'seguridad',
    label: 'Seguridad y privacidad',
    description: 'Sanea tu PDF sin que salga del dispositivo.',
    icon: ShieldCheck,
  },
  {
    id: 'convertir-a-pdf',
    label: 'Convertir a PDF',
    description: 'Imágenes y documentos de Office a PDF.',
    icon: FileInput,
  },
  {
    id: 'convertir-desde-pdf',
    label: 'Convertir desde PDF',
    description: 'Exporta tu PDF a otros formatos.',
    icon: FileOutput,
  },
] as const;
