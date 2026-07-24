# DocLab — Especificación de opciones por herramienta (doc vivo)

Referencia de TODAS las utilidades que cada herramienta debe ofrecer (filosofía "tipo Word": máxima
editabilidad). Marca el estado: ✅ hecho · 🟡 parcial · ⬜ pendiente. Se actualiza al implementar.

## Fundación reutilizable (`src/lib/editor/`, `src/components/editor-kit/`)
- ✅ Historial deshacer/rehacer (`useHistory` + historial manual con snapshot en el editor).
- ✅ Atajos (`useShortcuts`): Supr borra, Esc deselecciona, Ctrl+Z/Y, Ctrl+D duplica, flechas mueven (Shift=10×).
- ✅ Zoom (controles −/+/ajustar/%) + render responsive (`usePdfPages` escalado por zoom).
- ✅ Selección: clic selecciona, clic en vacío / Esc deselecciona.
- ✅ Panel de opciones contextual (solo muestra lo relevante).
- ✅ Primitivos: `ColorControl` (swatches + color libre), `BrushSlider` (con preview de grosor),
  `LabeledSlider`, `Segmented`, `ToggleIcon`, `ZoomControls`.
- ✅ Transformaciones: rotación, opacidad, duplicar, z-order (frente/fondo), alinear (centrar), borrar.
- ✅ Multi-selección (Shift+clic + **lazo/marquesina**), guías de alineación/snapping, tira de miniaturas (minimap).
- ⬜ Copiar/pegar entre páginas.

## 🎨 Editar PDF — ✅ (visión Canva)
Visor zoom/pan ✅ · Herramientas: Seleccionar, Texto, Lápiz, Resaltador, Formas (rect/elipse/línea/flecha),
Imagen, Firma (dibujar/teclear/subir + guardadas), Goma (pincel parcial) ✅ · Texto enriquecido ✅ · Lápiz ✅ ·
Formas ✅ · Transformaciones por elemento (SelectionFrame redimensión/rotación) ✅ · **Guías de alineación/snap** ✅ ·
**Doble-clic para editar texto** ✅ · **Barra flotante contextual** ✅ · **Minimap de páginas** ✅ ·
**Multi-selección** (Shift+clic + lazo, mover/duplicar/borrar en grupo) ✅ · **Sellos predefinidos**
(APROBADO/CONFIDENCIAL/URGENTE/fecha…) ✅ · **Fantasma de colocación** (texto) ✅ · undo/redo + atajos ✅ ·
⬜ Pendiente: tachado, recorte de imagen, copiar/pegar entre páginas.

## 🗂️ Organizar / Rotar / Eliminar — 🟡 (multi-selección)
Hecho: reordenar (drag), rotar, eliminar, presets por foco, **multi-selección Shift+clic + acciones en lote
(rotar/eliminar/todas/ninguna)**. ⬜ Pendiente: zoom de miniaturas (modal), duplicar página, insertar en blanco,
undo con toast, badges de modificadas.

## ✂️ Dividir / Extraer — 🟡 (Shift+clic)
Hecho: selección por clic + rangos, **Shift+clic para rango**, **invertir**, extraer a uno. ⬜ Pendiente: dividir
cada N, por tamaño, ZIP de varios PDFs, preview lateral, línea de corte.

## 🔗 Unir — ✅ (previsualización a nivel de página)
Hecho (v2): **rejilla de TODAS las páginas** del conjunto (no solo pág.1), **miniaturas perezosas**
(IntersectionObserver), **reordenar arrastrando entre y dentro de documentos** (SortableJS), **rotar y quitar
páginas sueltas**, motor `mergePages` (copia por documento → dedup de recursos, rotación por página). ⬜ Pendiente:
intercalar automático, separador en blanco, duplicar página.

## 🖼️ JPG a PDF — 🟡 (drag + orientación + márgenes + rotación)
Hecho: **drag&drop reordenar**, tamaño (A4/Carta/Fit), **orientación** (auto/vertical/horizontal), **márgenes**
(sin/normal/amplio), **rotación por imagen**. ⬜ Pendiente: cuadrícula N×M (álbum), calidad/compresión, fondo, borde.

## 🏞️ PDF a JPG/PNG — 🟡 (DPI + rango)
Hecho: formato, **DPI (72/150/300)**, **selección de páginas por rango**, ZIP. ⬜ Pendiente: galería preview con
descarga selectiva, calidad JPG ajustable, fondo transparente PNG.

## 🗜️ Comprimir — 🟡 (smart raster)
Hecho (v2): **compresión inteligente** — solo se rasterizan las páginas **escaneadas/imagen** (sin texto real +
con imagen, detectado por `getTextContent` + operator-list); las de **texto/vector se conservan intactas** (texto
seleccionable). Niveles screen/ebook/printer, antes/después + **estadística** (n.º rasterizadas vs conservadas),
copia única con dedup de recursos, y si no reduce devuelve el original.
**v3 (compresión real de imágenes)**: `lib/pdf/optimizeImages.ts` enumera los XObjects de imagen JPEG (DCTDecode)
y los **downsamplea (techo de px por nivel) + recomprime** reinyectando el stream con pdf-lib (`PDFRawStream.of` +
`context.assign`), **sin rasterizar el texto** — la palanca real de tamaño en PDF con fotos. Salta máscaras/SMask/
CMYK. Niveles → maxDim/quality (96/0.5 · 150/0.68 · 220/0.82). Reinyección verificada en Node (6/6). ⬜ Pendiente:
imágenes Flate (lossless), subset de fuentes, pasada estructural (qpdf-wasm).

## 📄 PDF a Office — ✅ ALTA FIDELIDAD (análisis de layout, on-device)
**Motor de estructura compartido** `lib/pdf/structure/` (análisis de layout sobre pdf.js, Apache-2.0, sin nube):
- `model.ts` (Span/Line/Block/Table/Image/Page/DocModel, coords top-left) · `assembleLines.ts` (spans→líneas) ·
  `assembleBlocks.ts` (columnas vía gutter, orden de lectura, títulos por tamaño, listas) · `detectTables.ts`
  (tablas con rejilla de líneas vectoriales) — TODO **funciones puras verificadas en Node**.
- `extractSpans.ts` (pdf.js getTextContent + fuente/negrita vía commonObjs) · `extractGraphics.ts` (operator-list:
  imágenes con CTM + segmentos de línea, defensivo) · `extractStructure.ts` (orquesta → DocModel).

**Anti-corrupción (Office abría con error)**: (1) `zipStore.ts` genera el `.xlsx` con un ZIP STORE clásico + CRC32
correcto (client-zip usaba *data-descriptors* que Office RECHAZA en OOXML; sigue valiendo para los ZIP de imágenes);
(2) `structure/sanitize.ts` elimina caracteres de control ilegales en XML 1.0 de todo el texto (Word/Excel/PPT); (3)
imágenes solo se embeben si son PNG válido. Validado en Node: zip íntegro (unzip -t) + XML bien formado (xmllint).

**v2 maquetación (Fase 1)**: `structure/layout.ts` (alineación left/center/right/justify, sangría 1ª línea,
interlineado por saltos de baseline — puros, verificados Node) + `structure/detectTablesStream.ts` (**tablas SIN
bordes** por análisis de espaciado/columnas, con guarda anti-falso-positivo para páginas a 2 columnas). assembleBlocks
adjunta align/indent/lineSpacing; extractStructure calcula caja de contenido (márgenes) + lattice+stream + espaciado
entre bloques. Word aplica alineación/sangría/interlineado/espaciado + **márgenes de sección** + anchos de columna +
imagen alineada; **Excel = una hoja por tabla** ("Tabla N") + hoja "Texto"; PPT con alineación/interlineado.
`PdfToOfficeTool` muestra **previsualización** (miniaturas). Validado docx+xlsx multi-hoja (unzip -t + xmllint).
**v2 Fase 2**: **color de texto** por muestreo de píxeles (`structure/extractColors.ts`: renderiza la página y toma el
color dominante "con tinta" de cada span — robusto para cualquier espacio de color, defensivo) + **fuente real**
(`cleanFontFamily` en extractSpans: limpia el nombre PostScript y mapea a familias conocidas). Word/PPT aplican color y
fuente por línea/bloque. Imágenes flotantes (posición absoluta) DIFERIDO (riesgo de solape con el texto reflujado).

Conversores reescritos sobre `DocModel`: **PDF→Word** (títulos H1-3, párrafos, negrita/cursiva, listas, **tablas**,
imágenes), **PDF→Excel** (tablas detectadas → celdas reales + texto a filas), **PDF→PowerPoint** (**texto editable
por bloque**, no la página como imagen; tablas e imágenes colocadas). `PdfToOfficeTool` igual (engine `pdf-to-office`,
import dinámico). 0 vuln. ⚠️ extractSpans/extractGraphics **no validados en navegador** (pdf.js worker no corre en
Node): pendiente prueba con PDFs reales y ajuste fino de fuentes/tablas/imágenes. Limitación conocida: color de texto
best-effort. `pdfLines.ts` queda como fallback no usado.
**v2 archivos grandes (Plan Maestro §6)**: `extractStructure`/conversores aceptan `PageRange` (1-based) → trocea
documentos. `PdfToOfficeTool` avisa en docs > 50 páginas y ofrece **selector de rango** (sufijo `-pX-Y`).
**v3 robustez + fidelidad (tras pruebas del usuario, reproducido en `PDF_pruebas/doclab-unido.pdf`)**: el crash
"muy complejo" era por **spans de espacio con anchura corrupta** → caja de contenido enorme → **margen negativo**
que rompía docx. Fixes: `structure/util.ts` (`minOf/maxOf` sin spread + `sanitizeSpans` recorta a la página),
`extractStructure` clampa márgenes ≥0 y es **defensivo por página** (try/catch). `detectAlign` reescrito (justify
tolera sangría de 1ª línea; right estricto) — 6/6 Node. `detectHeaderFooter.ts` saca encabezados/pies repetidos al
**Header/Footer** de Word. `docModelToWord` (separado de pdfToWord, testeable) = **flujo continuo** sin saltos por
página (no más páginas en blanco) + clamps de todos los valores docx. Verificado e2e sobre el archivo real
(margin −7870→+34, .docx sin crash, header/footer detectados). ⬜ Pendiente: **Web Worker** (OffscreenCanvas +
pdf.js anidado, con fallback) — prueba en navegador.

## 💧 Marca de agua — ✅ (preview vivo)
Hecho: **texto o imagen/logo**, **vista previa en vivo**, color libre, fuente, presets (CONFIDENCIAL…), opacidad,
tamaño, rotación, mosaico, **rejilla de 9 posiciones**, **rango de páginas** (todas/pares/impares/rango). ⬜ Pend:
detrás del contenido (pdf-lib dibuja encima), márgenes configurables.

## #️⃣ Números de página — ✅ (preview vivo)
Hecho: **vista previa en vivo**, **9 posiciones** (rejilla), **formato plantilla** ({n}/{total}/{N}) + presets,
color libre, **fuente**, **tamaño**, inicio, **omitir páginas** (+ contar o no en la secuencia). ⬜ Pend:
prefijo/sufijo aparte, espejo par/impar, márgenes.

## Primitivos / transversales reutilizables
- `LivePreview` (miniatura pág.1 + overlay) — previews en vivo de cualquier herramienta.
- `PositionGrid` (rejilla 3×3 de posiciones) — estándar de posicionamiento.
- `lib/pdf/layout.ts`: `anchorBottomLeft` (9 posiciones), `parsePages`, `standardFont`.
- **Toast global** (`lib/notify/toast.ts` + `<Toaster/>` en AppShell) — avisos de éxito/error/info.
- **Modo oscuro** (sec 13.5): tokens dark en index.css + `useTheme` + toggle en Header + init sin parpadeo en main.tsx.
- `editor-kit/SelectionFrame` (tiradores redimensión/rotación tipo Canva).
- **Dropzone animado** (sec 13.1): icono que respira, estado "¡Suéltalo aquí!", escala en drag.
- **Overlay de atajos** (sec 13.3): `ShortcutsModal` (tecla `?` o botón en Footer), `lib/uiEvents.ts`.
- **Badge de privacidad en proceso** (sec 13): `lib/processing.ts` (store + `useReportProcessing(busy)` por herramienta +
  `ProcessingTypeContext` en ToolPage) + `<ProcessingBanner/>` en AppShell — banner "Procesando en tu dispositivo /
  contenedor efímero" mientras cualquier herramienta trabaja.
- **Drag&drop global** (`GlobalDropzone` en AppShell): soltar un PDF en cualquier parte (fuera de `/h/...`) lo abre en
  el editor, con overlay "Suelta tu PDF". No pisa el dropzone propio de cada herramienta.
- **Onboarding** (`Onboarding` en AppShell): bienvenida de 3 pasos en la primera visita (bienvenida · privacidad ·
  todo-en-uno), recordada en `localStorage` (`doclab-onboarded-v1`).
- ✅ Transversales del informe completados.

## 🏷️ Metadatos — ✅
Hecho: **campos solo-lectura** (páginas/tamaño/fechas/creador/productor), título/autor/asunto, **chips de palabras
clave**, **indicador de cambios sin guardar**, **limpiar todo**, guardar solo si hay cambios.

## 🧾 Formularios PDF — ✅ P0+P1+P2 (guía: INFORME-FORMULARIOS-PDF.md)
Motor `lib/pdf/forms.ts` (pdf-lib, round-trip Node verificado): readFields (text/checkbox/radio/dropdown/optionlist
+ required/readOnly/multiline), fillFields (+flatten), addFields (text/textarea/checkbox/radio/dropdown +
required/readOnly/maxLength + tooltip TU accesibilidad; radio = opciones apiladas).
**v2 (apariencia de texto)**: fuente (Helvetica/Times/Courier estándar), tamaño (0=auto), **negrita/cursiva**,
**color** y **alineación** — vía DA `color /Fuente size Tf` + `updateAppearances(font)` (DA final verificado en
Node). Previsualización fiel (PreviewField aplica esos estilos). **Zoom rápido** (`useZoom`, multiplicador de layout
sin re-render; Ctrl/Cmd +/−/0) + **render retina** (`usePdfPages` sobre-muestrea por devicePixelRatio).
**Copiar/pegar campos** (Ctrl+C/X/V con buffer interno).
**v3 scroll independiente (tras pruebas)**: el panel Diseñar es de **altura fija** (`lg:h-[calc(100dvh-9rem)]`) con
el **documento** y la **barra lateral** scrolleando por separado (`overflow-y-auto`) → todas las herramientas/
propiedades siempre alcanzables aunque el documento sea largo.
**Rellenar**: **vista Documento** (rellena los campos directamente sobre el PDF renderizado vía pdf.js
`getAnnotations` + inputs superpuestos `.form-fill`) o vista Lista; **barra de progreso de obligatorios** + indicadores
(borde rojo/teal, `*`), **descargar sin rellenar** (directo) o rellenar+descargar, aplanar opcional. **Diseñar**:
pantalla inicial 2 modos (Rellenar/Crear) + detección auto; herramientas Mover/Texto/Área/Casilla/Opción/Lista; crear
arrastrando, mover (interact) + redimensionar (SelectionFrame), **atajos** (T/A/C/R/D/V, Ctrl+D, Supr, flechas),
**panel de propiedades** (nombre/etiqueta/tipo/opciones/obligatorio/solo-lectura/maxLength/**apariencia: grosor de
borde + color borde/fondo o transparente**/posición XYWH), duplicar/borrar, **modo Vista previa**.
**IA DESCARTADA** (soberanía del dato, ver memoria): nada del contenido del PDF sale del dispositivo.
⬜ Pendiente: alinear/distribuir + multi-selección, duplicar en serie, export/import datos JSON/CSV, perfil
autorelleno (localStorage), firma/adjunto, campo fecha, validación en vivo + lógica condicional. Prueba en navegador.

## 📄 PDF a Texto — 🟡
Hecho: extraer, copiar, .txt. ⬜ Pendiente: rango, layout vs flujo, export .md/.json.

## 📊 Excel a PDF — ✅ (estilos, 100% on-device, Plan Maestro §8 camino B)
Motor `lib/office/` (sin servidor, solo `fflate` MIT + parser XML propio + pdf-lib): `xml.ts` (parser XML
minúsculo sin deps, Node-testeable), `xlsxModel.ts` (parseStyles/parseSharedStrings/parseSheet/parseWorkbook →
fuentes/rellenos/bordes/cellXfs/numFmts/merges/geometría), `xlsxToPdf.ts` (render a pdf-lib). **Conserva**:
bordes con su **grosor por estilo** (hair/thin/medium/thick→0.25/0.5/1.25/2pt), **rellenos de celda**,
**negrita/cursiva** (Helvetica estándar), **color de fuente**, **alineación** (o por defecto: números a la
derecha), **celdas combinadas**, anchos de columna, y numFmt básico (fecha/hora/%/general). Ajuste a ancho de
página (escala), paginación vertical, una hoja por página, título por hoja. **Test Node 18/18** (estilos +
PDF válido). ⬜ Pendiente: fuentes reales incrustadas (fontkit), gráficos, paginación horizontal, congelar paneles.

## 🔒 Seguridad — ✅ (categoría `seguridad`, Plan Maestro §7)
- **Sanear PDF** (sin WASM, `lib/pdf/secure.ts`, **Node 11/11**): quita JavaScript (OpenAction, /Names/JavaScript,
  /AA, XFA), adjuntos (/Names/EmbeddedFiles, /AF) y metadatos (Info + XMP; `updateMetadata:false`).
- **Proteger / Desbloquear** (WASM `lib/pdf/secureWasm.ts`): cifrado **AES-256** y permisos (imprimir/copiar/
  editar/anotar) y descifrado, vía **`@neslinesli93/qpdf-wasm`** (ISC, 1.33MB, **autoalojado** con Vite `?url`,
  carga diferida). CSP: añadido `'wasm-unsafe-eval'` en `nginx.conf`. **Motor verificado en Node** (cifra/descifra/
  permisos: `/Encrypt` presente, pdf-lib sin pass falla, descifrado abre). Tools Proteger (contraseña+permisos) y
  Desbloquear. ⚠️ Ejecución en navegador pendiente de prueba del usuario (Node confirma el motor; build self-hosted OK).
- **Censurar** (redactar de verdad, sin WASM, `lib/pdf/redact.ts`): marcas visuales → **rasteriza solo las páginas
  afectadas** con las zonas en negro (el texto debajo DESAPARECE, no recuperable); el resto se conserva intacto.
- **Comparar dos PDF** (`lib/pdf/compare.ts` + `wordDiff.ts`, **diff Node 5/5**): diff de palabras (LCS) por página,
  resaltado añadido/borrado. ⬜ Pendiente: firmar, diff visual por píxeles, validar firma.

## 🗜️ Varias páginas por hoja (N-up) — ✅ (Organizar, Plan Maestro §2)
Motor `lib/pdf/nup.ts` (pdf-lib `embedPages`+`drawPage`, **test Node 8/8**): 2/4/6/9 por hoja en cuadrícula A4
(2-up landscape; resto portrait), escala a celda preservando proporción, **pre-filtra páginas sin Contents**
(las en blanco no rompen el guardado; embebido diferido). ⬜ Pendiente: tamaño Carta, márgenes/separación
configurables, marco por página.

## 🔮 Futuras (no implementadas)
Proteger/contraseña (qpdf-wasm) · Desbloquear · Redactar · Firmar standalone · OCR (tesseract.js) ·
Resumir/Traducir/Chatear (Gemini) · Comparar · Recortar · Reparar · PDF/A · Word/PPT→PDF (servidor opt-in).
