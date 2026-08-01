import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, PDFButton, PDFName, PDFString, PDFHexString, StandardFonts, TextAlignment, rgb, type Color, type PDFField, type PDFFont } from 'pdf-lib';

/**
 * Motor de formularios PDF (AcroForms), 100% en el navegador con pdf-lib.
 * - readFields: detecta los campos existentes y sus valores.
 * - fillFields: rellena por nombre y opcionalmente aplana (los deja fijos, no editables).
 * - addFields: crea campos nuevos sobre el PDF (modo diseño).
 */

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'button' | 'unknown';

export interface FormField {
  name: string;
  type: FormFieldType;
  /** texto: string · checkbox: boolean · radio/dropdown: string · optionlist: string[] */
  value: string | boolean | string[];
  /** opciones para radio/dropdown/optionlist */
  options?: string[];
  readOnly: boolean;
  required: boolean;
  multiline?: boolean;
  /** texto de referencia (placeholder) / tooltip, almacenado en el campo TU. */
  tooltip?: string;
}

/** Lee el tooltip/placeholder (campo TU) de un campo de formulario. */
function readTooltip(field: PDFField): string | undefined {
  try {
    const tu = field.acroField.dict.lookup(PDFName.of('TU'));
    if (tu instanceof PDFString || tu instanceof PDFHexString) return tu.decodeText();
  } catch { /* sin tooltip */ }
  return undefined;
}

export type FillValue = string | boolean | string[];

/** Lee los campos de formulario de un PDF y sus valores actuales. */
export async function readFields(bytes: Uint8Array): Promise<FormField[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  return form.getFields().map((f): FormField => {
    const name = f.getName();
    const readOnly = f.isReadOnly();
    const required = f.isRequired();
    if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() ?? '', readOnly, required, multiline: f.isMultiline(), tooltip: readTooltip(f) };
    if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked(), readOnly, required };
    if (f instanceof PDFRadioGroup) return { name, type: 'radio', value: f.getSelected() ?? '', options: f.getOptions(), readOnly, required };
    if (f instanceof PDFDropdown) return { name, type: 'dropdown', value: f.getSelected()[0] ?? '', options: f.getOptions(), readOnly, required };
    if (f instanceof PDFOptionList) return { name, type: 'optionlist', value: f.getSelected(), options: f.getOptions(), readOnly, required };
    if (f instanceof PDFButton) return { name, type: 'button', value: '', readOnly: true, required: false };
    return { name, type: 'unknown', value: '', readOnly: true, required: false };
  });
}

/** Rellena los campos indicados (por nombre). Si `flatten`, los fija (deja de ser editable). */
export async function fillFields(bytes: Uint8Array, values: Record<string, FillValue>, flatten = false): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  for (const f of form.getFields()) {
    const name = f.getName();
    if (!(name in values)) continue;
    const v = values[name];
    if (f instanceof PDFTextField && typeof v === 'string') f.setText(v);
    else if (f instanceof PDFCheckBox) { if (v) f.check(); else f.uncheck(); }
    else if (f instanceof PDFRadioGroup && typeof v === 'string') { if (v) f.select(v); }
    else if (f instanceof PDFDropdown && typeof v === 'string') { if (v) f.select(v); }
    else if (f instanceof PDFOptionList && Array.isArray(v) && v.length) f.select(v);
  }
  if (flatten) form.flatten();
  return doc.save();
}

export type NewFieldKind = 'text' | 'textarea' | 'checkbox' | 'dropdown' | 'radio';

export interface NewField {
  kind: NewFieldKind;
  name: string;
  /** etiqueta visible (informativa) — se usa también como tooltip de accesibilidad si no hay otro */
  label?: string;
  page: number;
  /** caja en puntos de página, origen arriba-izquierda (como el editor) */
  x: number;
  y: number;
  width: number;
  height: number;
  options?: string[];
  required?: boolean;
  readOnly?: boolean;
  multiline?: boolean;
  maxLength?: number;
  /** descripción para lectores de pantalla (campo TU del AcroForm) */
  tooltip?: string;
  /** texto de referencia (placeholder) que se muestra hasta que el usuario escribe. */
  placeholder?: string;
  /** apariencia de la caja */
  borderWidth?: number;
  borderColor?: string; // hex (#rrggbb)
  backgroundColor?: string | null; // hex o null = transparente
  /** apariencia del texto del campo (texto/área/lista) */
  fontFamily?: FormFontFamily;
  fontSize?: number; // 0 = automático
  textColor?: string; // hex (#rrggbb)
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export type FormFontFamily = 'Helvetica' | 'Times' | 'Courier';

/** Mapea familia + estilo a una de las 14 fuentes estándar (sin incrustar TTF). */
function standardFontFor(family: FormFontFamily = 'Helvetica', bold = false, italic = false): StandardFonts {
  if (family === 'Times') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === 'Courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/** Operadores PDF de color de relleno a partir de un hex, para el Default Appearance (DA). */
function daColorOps(hex?: string): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return `${+r.toFixed(4)} ${+g.toFixed(4)} ${+b.toFixed(4)} rg`;
}

const ALIGN_MAP = { left: TextAlignment.Left, center: TextAlignment.Center, right: TextAlignment.Right } as const;

/**
 * Aplica fuente/tamaño/color/alineación al texto de un campo. Escribe el DA completo
 * (`color /Fuente size Tf`) y deja que `updateAppearances` regenere la apariencia con
 * la fuente incrustada — así evitamos el error de pdf-lib cuando el DA no tiene `Tf`.
 */
async function applyTextAppearance(
  doc: PDFDocument,
  field: PDFField,
  nf: NewField,
  fontCache: Map<StandardFonts, PDFFont>,
): Promise<void> {
  if (!(field instanceof PDFTextField || field instanceof PDFDropdown)) return;
  const sf = standardFontFor(nf.fontFamily, nf.bold, nf.italic);
  let font = fontCache.get(sf);
  if (!font) { font = await doc.embedFont(sf); fontCache.set(sf, font); }
  const size = nf.fontSize && nf.fontSize > 0 ? nf.fontSize : 0; // 0 = auto-ajuste
  const color = daColorOps(nf.textColor) ?? '0 g';
  field.acroField.setDefaultAppearance(`${color} /Helv ${size} Tf`);
  if (field instanceof PDFTextField && nf.align) field.setAlignment(ALIGN_MAP[nf.align]);
  field.updateAppearances(font);
}

function hexToColor(hex?: string | null): Color | undefined {
  if (!hex) return undefined;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const int = parseInt(m[1]!, 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

/** Tooltip AcroForm (campo TU) — accesibilidad para lectores de pantalla. */
function setTooltip(field: PDFField, text: string) {
  try {
    field.acroField.dict.set(PDFName.of('TU'), PDFString.of(text));
  } catch {
    /* opcional: si la versión de pdf-lib no lo permite, lo omitimos */
  }
}

/** Crea campos de formulario nuevos sobre el PDF (modo diseño). */
export async function addFields(bytes: Uint8Array, fields: NewField[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const pages = doc.getPages();
  const used = new Set(form.getFields().map((f) => f.getName()));
  const fontCache = new Map<StandardFonts, PDFFont>();
  for (const nf of fields) {
    const page = pages[nf.page];
    if (!page) continue;
    let name = nf.name;
    while (used.has(name)) name = `${nf.name}_${Math.random().toString(36).slice(2, 6)}`;
    used.add(name);
    const { height } = page.getSize();
    const y = height - nf.y - nf.height; // arriba-izq → abajo-izq de pdf-lib
    const border = hexToColor(nf.borderColor);
    const background = hexToColor(nf.backgroundColor);
    const box = {
      x: nf.x,
      y,
      width: nf.width,
      height: nf.height,
      borderWidth: nf.borderWidth ?? 1,
      ...(border ? { borderColor: border } : {}),
      ...(background ? { backgroundColor: background } : {}),
    };

    let field: PDFField | null = null;
    if (nf.kind === 'text' || nf.kind === 'textarea') {
      const tf = form.createTextField(name);
      if (nf.kind === 'textarea' || nf.multiline) tf.enableMultiline();
      if (nf.maxLength && nf.maxLength > 0) tf.setMaxLength(nf.maxLength);
      tf.addToPage(page, box);
      field = tf;
    } else if (nf.kind === 'checkbox') {
      const cb = form.createCheckBox(name);
      cb.addToPage(page, box);
      field = cb;
    } else if (nf.kind === 'dropdown') {
      const dd = form.createDropdown(name);
      if (nf.options?.length) dd.addOptions(nf.options);
      dd.addToPage(page, box);
      field = dd;
    } else if (nf.kind === 'radio') {
      const rg = form.createRadioGroup(name);
      const opts = nf.options?.length ? nf.options : ['Opción 1', 'Opción 2'];
      const rowH = Math.max(14, nf.height / opts.length);
      opts.forEach((opt, i) => {
        const oy = height - (nf.y + i * rowH) - (rowH - 2);
        rg.addOptionToPage(opt, page, { x: nf.x, y: oy, width: Math.min(rowH - 2, nf.width), height: rowH - 2 });
      });
      field = rg;
    }

    if (field) {
      if (nf.required) field.enableRequired();
      if (nf.readOnly) field.enableReadOnly();
      const tip = nf.placeholder || nf.tooltip || nf.label;
      if (tip) setTooltip(field, tip);
      await applyTextAppearance(doc, field, nf, fontCache);
    }
  }
  return doc.save();
}
