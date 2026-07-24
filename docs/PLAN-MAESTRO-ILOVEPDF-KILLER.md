# DocLab — Plan Maestro para convertirse en el “iLovePDF killer”

> **Documento de arquitectura y roadmap riguroso.** Versión 1.0 · 2026-06-28
> Tesis del producto: **el PDF más completo del mercado SIN traicionar la privacidad** — *nada del
> contenido del usuario sale del dispositivo*. Cada decisión de este plan se mide contra ese eje.
> Restricciones invariantes: **0 vulnerabilidades** (`npm audit` limpio), CSP `script-src 'self'`
> (WASM autoalojado, cero CDNs), `tsc -b` + `oxlint` + `vite build` en verde.

---

## 0. Cómo leer este documento

1. **Diagnóstico** (§1–§2): qué tenemos hoy, con qué madurez, y dónde estamos respecto a iLovePDF.
2. **Investigación + diseño técnico por feature** (§3–§8): para cada cosa que pediste, *cómo lo hacen
   las herramientas profesionales*, qué libros/algoritmos usar, y el plan concreto (archivos, firmas,
   pasos, verificación). Estas son las secciones “densas”.
3. **Arquitectura transversal** (§9): Web Workers, archivos grandes, estrategia WASM, CSP, rendimiento.
4. **Roadmap por sprints** (§10), **riesgos** (§11), **decisiones de librería/licencia** (§12) y
   **puertas de calidad** (§13).

Leyenda de esfuerzo: ▁ bajo (≤1 día) · ▃ medio (2–4 días) · ▅ alto (1–2 semanas) · ▇ épico (>2 semanas).
Prioridad: ⭐⭐⭐ imprescindible para “killer” · ⭐⭐ alta · ⭐ nice-to-have.

---

## 1. Estado actual — auditoría honesta (19 tarjetas, 13 motores)

Inventario real leído del código (`frontend/src/lib/tools.ts` + `lib/pdf/*`). La columna **Madurez** es mi
valoración técnica, no marketing.

| Herramienta | Motor | Proc. | Madurez | Veredicto |
|---|---|---|---|---|
| Editar PDF (anotar/texto/dibujo/imagen) | `edit` | 🟢 | 🟢 Sólido | Diferenciador real. |
| Formularios (rellenar + diseñar) | `forms` | 🟢 | 🟡 Bueno, incompleto | Sin fuente/tamaño, preview ráster fija, sin copiar/pegar campos. **(§3)** |
| Marca de agua | `watermark` | 🟢 | 🟢 Sólido | OK. Falta marca de agua de **imagen** y mosaico. |
| Editar metadatos | `metadata` | 🟢 | 🟢 Sólido | OK. |
| Unir PDF | `merge` | 🟢 | 🟡 Funcional | Sin previsualización del resultado, sin reordenar a nivel de página. **(§5)** |
| Dividir / Extraer | `split` | 🟢 | 🟢 Sólido | OK. |
| Organizar / Rotar / Eliminar | `organize` | 🟢 | 🟢 Sólido | OK. |
| Números de página | `page-numbers` | 🟢 | 🟢 Sólido | OK. |
| **Comprimir PDF** | `compress` | 🟢 | 🔴 **Deficiente** | **Rasteriza TODO a JPEG → mata el texto.** Es lo opuesto a compresión profesional. **(§4)** |
| JPG→PDF | `images-to-pdf` | 🟢 | 🟢 Sólido | OK. |
| **PDF→Word** | `pdf-to-office` | 🟢 | 🟡 Prometedor | Buena base (layout v2), pero **hilo principal** → muere con archivos grandes. **(§6)** |
| PDF→PowerPoint | `pdf-to-office` | 🟢 | 🟡 Aceptable | Texto editable por bloque. |
| PDF→Excel | `pdf-to-office` | 🟢 | 🟡 Aceptable | Una hoja por tabla. Sin estilos. |
| PDF→JPG / PNG | `pdf-to-images` | 🟢 | 🟢 Sólido | OK. |
| PDF→Texto | `pdf-to-text` | 🟢 | 🟢 Sólido | OK. |
| **Seguridad** (cualquiera) | — | — | ⚫ **Inexistente** | Categoría entera ausente. **(§7)** |
| **Office→PDF** (Excel→PDF con estilos) | backend `gotenberg` | 🟡 | 🟠 Existe en backend, no en catálogo | Hay ruta `/convert/office` viva pero ninguna tarjeta. **(§8)** |

**Backend**: Express + Gotenberg (LibreOffice headless) para Office→PDF, efímero en memoria; Gemini para
búsqueda/asistente (solo metadatos/texto de consulta, no contenido del documento). Sano y minimalista.

**Activos reutilizables que ya tenemos** (no reinventar):
- Motor de análisis de layout `lib/pdf/structure/*` (spans, líneas, bloques, tablas lattice+stream, color por
  muestreo, fuentes). **Es nuestra joya** y la base del PDF→Office.
- `pdfjs.ts` (render/worker autoalojado), `usePdfPages.ts` (render por página), `zipStore.ts` (ZIP STORE que
  Office acepta), `sanitize.ts`, `handoff.ts` (encadenado entre herramientas).
- `interactjs`, `sortablejs`, `pdf-lib`, `docx`, `pptxgenjs`, `pdfjs-dist`. **0 vulnerabilidades.**

---

## 2. Análisis de brechas vs. iLovePDF / Stirling-PDF / Sejda

iLovePDF ofrece ~27 herramientas. Lo que **nos falta** para igualar o superar (priorizado):

### 2.1 Brechas que nos separan de “killer” (⭐⭐⭐)
1. **Seguridad completa**: Proteger/Desproteger con contraseña, permisos, **Redactar de verdad**, Firmar,
   Sanitizar. *Es nuestra mejor baza de marketing* (privacidad) y hoy es un cero. → **§7**.
2. **Compresión profesional** (mantener texto vectorial, recomprimir solo imágenes, deduplicar). → **§4**.
3. **PDF→Word robusto** con archivos grandes (donde iLovePDF a veces ni deja, y nosotros nos colgamos). → **§6**.
4. **OCR** (PDF escaneado → buscable) 100% local con `tesseract.js`. Encaja perfecto con la tesis.

### 2.2 Brechas de alto valor (⭐⭐)
5. **Excel→PDF (y Word/PPT→PDF) con fidelidad de estilos**: líneas, colores, negritas. → **§8**.
6. **Unir con previsualización** y edición a nivel de página. → **§5**.
7. **Formularios pro**: fuente, tamaño, zoom, copiar/pegar. → **§3**.
8. **Comparar dos PDF** (diff visual + texto). **Recortar (crop)**. **N-up** (varias págs por hoja).
9. **PDF/A** (archivado legal) y **Reparar PDF**.

### 2.3 Nice-to-have (⭐)
10. TXT/Markdown/HTML→PDF, extraer imágenes, inspector de PDF, cuadernillo (booklet), firma certificada PAdES.

> **Conclusión estratégica:** el camino más corto a “killer” no es *más* herramientas sino **subir la calidad
> de las 4 cosas que la gente realmente juzga** (comprimir, convertir a Word, seguridad, formularios) y
> **añadir la categoría Seguridad entera**, que además es donde nuestra tesis de privacidad es imbatible.

---

## 3. Formularios PDF — fuente, tamaño, preview de calidad, zoom rápido y copiar/pegar

### 3.1 Qué pediste y dónde estamos
- **Elegir tipo de fuente y tamaño** del campo → hoy `NewField` (`forms.ts`) **no tiene** `fontFamily` ni
  `fontSize`; pdf-lib no escribe el *Default Appearance* (`/DA`), así que el visor pinta con su fuente por
  defecto.
- **Preview de más calidad** → `usePdfPages` rasteriza a PNG a un ancho fijo (`760`/`820`px) sin tener en
  cuenta `devicePixelRatio`; en pantallas retina se ve blando.
- **Zoom rápido** → no existe; el documento se renderiza a un tamaño y punto.
- **Copiar campos con atajos** → solo hay `Ctrl+D` (duplicar con offset +12,+12). No hay copiar/pegar real,
  ni pegar en otra página, ni multiselección.

### 3.2 Investigación — cómo se hace bien
- **Fuente/tamaño de un AcroForm**: el aspecto del texto de un campo se controla con el string **`/DA`
  (Default Appearance)**, p. ej. `/Helv 12 Tf 0 g` (fuente *Helv*, 12pt, negro). La fuente debe estar en el
  **`/DR` (Default Resources)** del AcroForm. pdf-lib expone `PDFTextField.setFontSize(n)` y
  `updateFieldAppearances(font)`; para fuentes no estándar hay que **incrustar el TTF** con
  `@pdf-lib/fontkit` (`doc.registerFontkit(fontkit)` + `doc.embedFont(bytes)`), MIT, 0 CVE.
- **Preview nítida**: render a `escala_css × devicePixelRatio` y mostrar a tamaño CSS (downscale del navegador
  = nitidez retina). Es como lo hacen todos los visores serios.
- **Zoom fluido**: re-renderizar a la nueva escala es caro; lo profesional es **CSS `transform: scale()` para
  el zoom interactivo** (instantáneo) y **re-rasterizar “bajo demanda”** (debounce) solo cuando el usuario se
  detiene en un nivel de zoom, para recuperar nitidez. Los campos overlay escalan con la misma transform.
- **Copiar/pegar**: buffer en memoria (no portapapeles del SO, para no pedir permisos) con
  `Ctrl+C`/`Ctrl+V`/`Ctrl+X`, multiselección con `Shift`/marquesina, y “pegar” coloca con offset relativo al
  cursor o en la página visible.

### 3.3 Plan de implementación
**Modelo y motor (`lib/pdf/forms.ts`)**
```ts
// NewField += apariencia de texto
fontFamily?: 'Helvetica' | 'Times' | 'Courier' | string; // string = familia a incrustar
fontSize?: number;        // 0 = auto (pdf-lib ajusta)
textColor?: string;       // hex
align?: 'left' | 'center' | 'right';
```
- En `addFields`: tras crear el `PDFTextField`/`PDFDropdown`, llamar `tf.setFontSize(nf.fontSize ?? 0)`,
  `tf.setAlignment(...)`, y al final `form.updateFieldAppearances(font)` con la fuente elegida.
- Fuentes estándar (Helvetica/Times/Courier) → directas. Fuentes “de marca” → `embedFont` con fontkit
  (lazy-load del TTF; subset automático para no inflar el PDF).

**UI (`components/tools/FormsTool.tsx` → `PropertyPanel` + nuevo `usePdfCanvasZoom`)**
- Panel “Apariencia del texto”: selector de fuente (las 14 estándar + “Subir fuente .ttf”), tamaño (número +
  “auto”), color, alineación. Reutiliza el patrón visual del panel de borde/fondo ya existente.
- Sustituir el render fijo por **`renderPageThumbnail(pdf, n, Math.round(base.width * displayScale * dpr))`**
  y `style={{ width: cssWidth }}` → nitidez retina sin cambiar el layout.
- Barra de zoom (50–300%, atajos `Ctrl/Cmd +/−/0`, rueda con `Ctrl`): aplica `transform: scale(z)` al
  contenedor de página + overlays; debounce 250ms → re-rasteriza a la escala efectiva.
- Copiar/pegar: estado `clipboard: Placed[]`; `Ctrl+C` copia selección, `Ctrl+V` pega con `crypto.randomUUID()`
  + nombres únicos + offset, `Ctrl+X` corta. Extender la multiselección (set `selectedIds`) y marquesina.

**Esfuerzo** ▃ · **Prioridad** ⭐⭐ · **Riesgo** bajo (todo pdf-lib + DOM, sin WASM nuevo).
**Verificación**: generar PDF con `/DA` correcto (abrir en Acrobat/Chrome y comprobar fuente+tamaño);
test Node de `addFields` (assert que el dict del campo contiene `/DA`); prueba visual de zoom/nitidez/copia.

---

## 4. Compresor PDF profesional (hoy es el punto más débil)

### 4.1 El problema actual (crítico)
`compress.ts` **rasteriza cada página a JPEG y la re-inserta como imagen**. Consecuencias:
- El **texto deja de ser seleccionable/buscable** (catástrofe para un PDF de texto).
- En documentos vectoriales **engorda** en vez de adelgazar.
- Es exactamente lo que un usuario que viene de iLovePDF detecta en 2 segundos.

iLovePDF/Smallpdf/Ghostscript hacen lo contrario: **tocan lo mínimo**, conservan texto y vectores, y solo
optimizan lo que pesa de verdad (imágenes y estructura).

### 4.2 Investigación — anatomía de la compresión profesional
Un compresor serio aplica, en orden, técnicas **sin pérdida** y luego **con pérdida controlada**:

**A. Sin pérdida (estructural) — nunca degrada nada visible:**
1. **Object streams + Flate**: agrupar objetos y comprimir todos los streams con deflate (`/ObjStm`).
2. **Eliminar objetos huérfanos/duplicados**: páginas borradas, recursos no referenciados, XObjects
   repetidos (deduplicación por hash).
3. **Subsetting/dedup de fuentes**: una fuente incrustada entera puede pesar cientos de KB; subset a los
   glifos usados.
4. **Linearización** (“fast web view”) y limpieza de metadatos redundantes.

**B. Con pérdida (imágenes) — el 80% del peso real:**
5. **Downsampling**: una imagen a 600 DPI en una página que se ve a 96–150 DPI sobra; bajar a un techo
   (p. ej. 150 DPI “ebook”, 300 “printer”).
6. **Recompresión**: JPEG con calidad ajustable para fotos; mantener PNG/Flate para line-art; convertir a
   JPEG solo cuando conviene.

**C. Páginas escaneadas** (PDF que ya es una foto por página): ahí **sí** rasterizar+JPEG es correcto, e
incluso aplicar binarización/MRC. La clave es **detectar** ese caso y no aplicarlo a páginas de texto.

### 4.3 Estrategia recomendada para DocLab (local-first, sin AGPL)
El reto: hacer A+B en el navegador, sin librerías AGPL (Ghostscript/MuPDF son AGPL → descartadas para un
portfolio “limpio”). Propongo un **compresor en tres carriles** que elige por página:

```
Para cada página:
  ├─ ¿Es escaneada? (≈0 texto extraíble y ≥1 imagen que cubre >80% del área)
  │      → Carril RASTER: render → JPEG a DPI objetivo (el código actual, pero SOLO aquí).
  ├─ ¿Tiene imágenes grandes embebidas? (vía operator-list, ya las enumeramos en extractGraphics.ts)
  │      → Carril IMAGEN: recomprimir/downsamplear esas imágenes, conservar texto/vectores.
  └─ Página de texto/vector pura
         → Carril ESTRUCTURAL: no tocar el contenido; solo optimización sin pérdida del documento.
```

**Implementación por capas (incremental, cada capa aporta valor sola):**

- **Capa 1 — “Smart raster” (▁, sin libs nuevas, ya mismo):** arreglar lo peor. Detectar páginas escaneadas
  vs. texto; **solo** rasterizar las escaneadas; las de texto se copian intactas con `pdf-lib`. Ya elimina el
  “mata-texto”. Detección: `page.getTextContent()` con <~10 chars útiles ⇒ escaneada.
- **Capa 2 — Optimización estructural sin pérdida (▃):** pasar el PDF por **`pdfcpu`-WASM** o **`qpdf`-WASM**
  (ambos **Apache-2.0**, autoalojables) con `optimize`/`--object-streams=generate --compress-streams=y
  --recompress-flate`. Lazy-load del WASM solo al usar el compresor. Ganancia típica 5–30% sin tocar píxeles.
- **Capa 3 — Downsampling/recompresión de imágenes (▅):** enumerar XObjects de imagen (ya tenemos el render
  por operador en `extractGraphics.ts`), recomprimir las que superen el DPI objetivo y **reinyectarlas**. La
  reinyección dentro del árbol de objetos es la parte difícil; si `pdfcpu`/`qpdf` exponen API de imágenes en
  WASM, usarla; si no, reconstruir la página con `pdf-lib` preservando el stream de contenido.

**UI**: niveles `Extrema / Recomendada / Ligera` (mapear a DPI 96/150/220 + calidad 0.5/0.72/0.85), con
**“antes/después” (peso original → peso final + % ahorro)** y aviso explícito cuando una página se rasteriza
(“esta página era un escaneado”).

**Esfuerzo total** ▅ (por capas) · **Prioridad** ⭐⭐⭐ · **Riesgo**: medio (validar WASM bajo CSP, ver §9.3).
**Verificación**: corpus de prueba (PDF de texto, PDF con fotos, PDF escaneado, PDF vectorial) → medir
ratio de compresión y **confirmar que el texto sigue siendo seleccionable** salvo en escaneados; `qpdf
--check` sobre la salida; abrir en Acrobat sin warnings.

---

## 5. Unir PDF — previsualización del resultado y edición a nivel de página

### 5.1 Estado y objetivo
Hoy `MergeTool` muestra **una miniatura (pág. 1) por archivo** y los une tal cual. Pediste **previsualizar el
PDF unido**. iLovePDF muestra una **rejilla de todas las páginas** en el orden final, y deja **reordenar,
rotar y quitar páginas sueltas** antes de unir.

### 5.2 Plan
- **Modelo a nivel de página**: en lugar de `Item[]` (archivos), construir `Page[] = { fileId, pageIndex,
  thumb, rotation }` aplanando todos los documentos. Reutilizar `renderPageThumbnail` (ya importado) para
  generar la tira/rejilla.
- **Rejilla unificada** con `sortablejs` (ya instalado) para arrastrar páginas **entre y dentro** de
  documentos; botones de rotar/eliminar por página; separadores visuales por documento de origen.
- **Construcción del resultado**: `mergePdfs` pasa de recibir `Uint8Array[]` a recibir una **lista ordenada
  de (documento, índice de página, rotación)**; con `copyPages` por índice y `page.setRotation()`.
- **Rendimiento**: render de miniaturas perezoso (IntersectionObserver) para soportar cientos de páginas sin
  bloquear; cache por `fileId:pageIndex`.

**Esfuerzo** ▃ · **Prioridad** ⭐⭐ · **Riesgo** bajo. Bonus: este componente de “rejilla de páginas” se
**reutiliza** en Organizar y en el futuro editor de Unir/Dividir visual.
**Verificación**: unir 3 PDFs reordenando páginas cruzadas + rotando una → abrir y comprobar orden/rotación;
test Node del nuevo `mergePages`.

---

## 6. PDF→Word de nivel profesional (incl. archivos grandes)

### 6.1 Diagnóstico
Tenemos buena base (layout v2: párrafos, alineación, sangría, interlineado, tablas lattice+stream, color,
fuente). Pero:
- **Todo corre en el hilo principal** (`extractStructure` + render + muestreo de color por página) → con
  archivos grandes la pestaña se **congela** y puede agotar memoria (cada página rinde a canvas 1.5×). Por eso
  “con archivos grandes ni deja”.
- La **fidelidad** aún pierde frente a iLovePDF en: columnas múltiples robustas, encabezados/pies repetidos,
  listas anidadas, imágenes flotantes, y orden de lectura en layouts complejos.

### 6.2 Investigación — cómo escala una conversión seria
- **Fuera del hilo principal**: el trabajo pesado va a un **Web Worker**; pdf.js corre dentro con
  `OffscreenCanvas` para el muestreo de color. La UI solo recibe progreso. (iLovePDF lo hace en servidor; en
  local, el worker es el equivalente.)
- **Procesamiento por lotes y *streaming***: no cargar 500 páginas a la vez. Procesar en ventanas (p. ej. 10
  páginas), **liberar** `page.cleanup()` y canvases, y **construir el `.docx` incrementalmente**. Memoria
  acotada → archivos enormes posibles.
- **Reconstrucción de layout (mejoras de fidelidad)** que usan los buenos (pdf2docx, Adobe):
  - **Encabezado/pie repetidos**: bloques que aparecen en la misma Y en ≥50% de páginas → a `header`/`footer`
    de la sección de Word, no al cuerpo.
  - **Orden de lectura por XY-cut recursivo** y detección de **columnas** estable (ya iniciada con
    `findColumnCut`): cortar por “ríos” de blanco verticales antes de ensamblar líneas.
  - **Listas anidadas**: nivel por sangría (x) además del marcador.
  - **Imágenes flotantes** (lo diferido): colocación absoluta con `floating` de docx **reservando el hueco**
    para no solapar el texto reflujado (anchor + wrap `topAndBottom`).

### 6.3 Plan
**Arquitectura (nuevo `lib/pdf/convert.worker.ts` + `lib/pdf/convertClient.ts`)**
- Mover `extractStructure`, `pdfToWord/Excel/Pptx` al worker; API con `postMessage`/Comlink (MIT) y
  callbacks de progreso. `PdfToOfficeTool` solo orquesta y pinta el progreso.
- `OffscreenCanvas` en `extractColors.ts` (detección `typeof OffscreenCanvas`; fallback al canvas DOM si no).
- **Procesado por ventanas** en `extractStructure`: opción `{ pageRange?, batchSize }`; emitir bloques por
  página y ensamblar el documento a medida (no acumular todos los spans).
- **Guard de tamaño**: si `numPages > N` o bytes > M, avisar y permitir **elegir rango** (igual que hacen las
  apps cuando el doc es enorme), en vez de morir.

**Fidelidad (incremental sobre `structure/*`)**
1. Header/footer repetidos → `assembleBlocks` marca y `pdfToWord` los manda a `Header`/`Footer`.
2. XY-cut/columnas robustas (endurecer `findColumnCut`).
3. Listas anidadas por sangría.
4. Imágenes flotantes con reserva de hueco (reactivar lo diferido, ya con feedback de navegador).

**Esfuerzo**: worker ▃ + fidelidad ▅ (incremental) · **Prioridad** ⭐⭐⭐ · **Riesgo**: medio (el worker
cambia el flujo; pdf.js-en-worker requiere config de `workerSrc`/`type:module`).
**Verificación**: convertir un PDF de 300+ páginas sin congelar la UI (medir memoria/tiempo); comparar
visualmente columnas/encabezados/listas vs. original en 5 PDFs reales; regresión de los tests puros de layout.

---

## 7. Suite de Seguridad — la categoría que nos hace “killer” (hoy = 0)

> Esta es **la sección más estratégica**: la privacidad es la tesis del proyecto y aquí no tenemos nada.
> Hacer cifrado/redacción **100% en el navegador** es algo que iLovePDF (que sube el archivo) **no puede
> ofrecer con la misma promesa**. Es el mejor material para LinkedIn.

### 7.1 Alcance
| Función | Proc. | Técnica | Esf. | Prio. |
|---|---|---|---|---|
| **Proteger con contraseña** (cifrar AES-256) | 🔵 WASM | `qpdf`/`pdfcpu`-WASM (Apache-2.0) | ▃ | ⭐⭐⭐ |
| **Quitar contraseña** (con la clave) | 🔵 WASM | idem `--decrypt` | ▃ | ⭐⭐ |
| **Permisos** (no imprimir/copiar/editar) | 🔵 WASM | idem flags de permisos | ▃ | ⭐ |
| **Redactar de verdad** | 🟢 | Rasterizar la zona marcada y **eliminar el texto real** debajo | ▅ | ⭐⭐⭐ |
| **Firmar** (firma dibujada/imagen) | 🟢 | canvas + `pdf-lib` (estampar) | ▃ | ⭐⭐⭐ |
| **Sanitizar** (quitar JS, archivos embebidos, metadatos) | 🟢/🔵 | `pdf-lib` + `pdfcpu` | ▃ | ⭐⭐ |
| Firma digital certificada (PAdES) | 🟡/🔵 | WebCrypto + estructura de firma | ▇ | ⭐ |

### 7.2 Investigación — puntos finos
- **Cifrado real**: `pdf-lib` **no cifra**. Hay que usar WASM. `qpdf` (Apache-2.0) y `pdfcpu` (Apache-2.0)
  hacen AES-256, permisos y *decrypt*. Ambos compilan a WASM y se pueden **autoalojar** (cumple CSP). Go-WASM
  (pdfcpu) pesa más (~varios MB) pero **cubre además** optimize/stamp/redact/validate → un solo binario para
  varias herramientas. Decisión en §12; **spike obligatorio** para confirmar paquete npm, tamaño y que corre
  bajo CSP (ver §9.3: WASM necesita `'wasm-unsafe-eval'`).
- **Redacción correcta (lo que hace mal todo el mundo)**: dibujar un rectángulo negro **no** borra el texto —
  sigue debajo y se copia. Redacción real = **rasterizar la región** marcada (convertirla en píxeles) y
  **eliminar los objetos de texto/imagen** que caían en ella, de modo que no quede dato recuperable. Encaja
  con nuestra tesis y es un sello de calidad. Variante simple y segura: rasterizar **toda la página** que
  contiene redacciones y reconstruirla sin su capa de texto (garantía total, coste: esa página pierde
  selección de texto — aceptable y honesto).
- **Firma**: empezar por firma **visual** (dibujas con el dedo/ratón o subes PNG) estampada con `pdf-lib`
  (rápido, alto valor). La firma **criptográfica PAdES** (validez legal) es un épico aparte (WebCrypto +
  CMS/PKCS#7 + sellado) → fase posterior.

### 7.3 Plan
- Nuevo motor `security` + tarjetas: `proteger-pdf`, `desproteger-pdf`, `permisos-pdf`, `redactar-pdf`,
  `firmar-pdf`, `sanitizar-pdf`. Nueva categoría `seguridad` en `categories.ts`/`tools.ts`.
- `lib/pdf/secure.ts`: wrapper lazy del WASM (`encrypt(bytes, userPwd, ownerPwd, perms)`, `decrypt`,
  `permissions`, `sanitize`). Carga el `.wasm` autoalojado solo al usar la herramienta.
- `lib/pdf/redact.ts`: UI de marcado (reusar el lienzo de Formularios/Editor) → rasterizar página(s)
  afectadas con pdf.js → reconstruir PDF sin texto en esas páginas.
- `components/editor-kit/SignatureModal.tsx` **ya existe** → conectar a `firmar-pdf` (estampar en posición).

**Esfuerzo** ▅ (suite) · **Prioridad** ⭐⭐⭐ · **Riesgo**: el WASM y la CSP (mitigado por spike).
**Verificación**: proteger→abrir pide contraseña (Acrobat/Chrome); desproteger con clave correcta funciona y
con incorrecta falla limpio; **redacción**: copiar/seleccionar sobre la zona redactada no devuelve el texto
(prueba con `pdftotext`); firma aparece en la posición correcta y se aplana.

---

## 8. Excel→PDF (y Office→PDF) con fidelidad de estilos: líneas, colores, negritas

### 8.1 La pregunta que hiciste
“Cómo conseguir los estilos de Excel a PDF: líneas más gruesas, colores, fuentes negritas…”. Es la conversión
**Excel→PDF** (no PDF→Excel). Tenemos dos caminos y conviene ofrecer **ambos** con la elección clara para el
usuario, fiel a la filosofía.

### 8.2 Camino A — Servidor efímero (máxima fidelidad, ya casi listo)
La ruta `POST /convert/office` con **Gotenberg/LibreOffice** ya existe y produce PDF con **fidelidad casi
perfecta** (LibreOffice entiende todo el formato de Excel). Coste: el archivo **sale del dispositivo** (aunque
sea efímero, en memoria, sin disco). → Ofrecerlo **solo como opción explícita y opt-in** (“conversión de alta
fidelidad en servidor seguro; el archivo se procesa en memoria y se borra al instante”), nunca por defecto, y
con badge 🟡 honesto. Trabajo: reactivar la tarjeta + UI de aviso. **Esf.** ▁.

### 8.3 Camino B — 100% en el navegador (fiel a la tesis) — el que de verdad nos diferencia
Renderizar Excel→PDF **localmente** preservando estilos. Nadie “fácil” lo hace bien en cliente; es nuestra
oportunidad. Requiere **leer el modelo OOXML de la hoja + sus estilos** y **pintar a PDF con `pdf-lib`**.

**Investigación — el modelo de estilos de XLSX (OOXML SpreadsheetML).** Un `.xlsx` es un ZIP:
- `xl/worksheets/sheetN.xml`: filas `<row>` y celdas `<c r="B2" s="3" t="s"><v>…</v></c>`. El atributo
  **`s`** es el índice de estilo; `t` el tipo (`s`=shared string, `inlineStr`, número por defecto). Anchos de
  columna en `<cols>`, altos en `<row ht>`, combinadas en `<mergeCells>`.
- `xl/sharedStrings.xml`: tabla de cadenas (las celdas `t="s"` referencian por índice).
- `xl/styles.xml`: **aquí están los estilos**:
  - `<fonts>`: cada `<font>` con `<sz val>`, `<b/>` (negrita), `<i/>`, `<color rgb="FFRRGGBB"/>`, `<name val>`.
  - `<fills>`: `<patternFill><fgColor rgb/></patternFill>` (color de fondo de celda).
  - `<borders>`: `<left/right/top/bottom style="thin|medium|thick|…" >` + `<color>` → **el grosor de línea**.
  - `<cellXfs>`: lista de `<xf fontId=".." fillId=".." borderId=".." applyFont="1" …/>`. El `s` de la celda
    indexa aquí, y de aquí se saltan a fontId/fillId/borderId. **Esa es toda la cadena de estilo.**
  - `numFmts`/`numFmtId`: formato de número/fecha (para mostrar “1.234,50 €” en vez de `1234.5`).

**Algoritmo de render (nuevo `lib/office/xlsxToPdf.ts`):**
1. **Descomprimir** el `.xlsx` con **`fflate`** (MIT, diminuto, 0 CVE) y parsear los XML con **`DOMParser`**
   (nativo, seguro, sin libs).
2. Construir tablas de estilo: `fonts[]`, `fills[]`, `borders[]`, `cellXfs[]`, `sharedStrings[]`.
3. Para cada hoja: calcular **geometría** (x de columnas desde anchos, y de filas desde altos; merges).
4. Pintar con `pdf-lib`, celda a celda:
   - **Fondo**: `page.drawRectangle({ color: fill })`.
   - **Bordes**: `page.drawLine({ thickness })` mapeando `thin→0.5pt`, `medium→1pt`, `thick→2pt`, con color.
   - **Texto**: fuente según negrita (`Helvetica-Bold` vs `Helvetica`; o TTF real vía fontkit), `size`,
     `color`, alineación; valor formateado con `numFmt`.
   - **Paginación**: trocear filas/columnas en páginas A4 (con repetición de cabecera opcional).
5. **Fases de fidelidad**: F1 = bordes/colores/negrita/alineación/anchos (las 14 fuentes estándar). F2 =
   fuentes reales incrustadas (fontkit + subset), `numFmt` completo, gráficos como imagen (rasterizar el chart
   si lo hay), congelar paneles → ignorable.

> Reutilización: la simetría con nuestro **PDF→Excel** es total (mismo modelo OOXML). Y `fflate` puede además
> **sustituir a `client-zip`/`zipStore`** unificando lectura+escritura de ZIP con una sola lib MIT.

**Word→PDF / PPT→PDF en cliente** son mucho más difíciles (flujo de texto, temas, SmartArt). Recomendación:
**Excel→PDF en cliente** (camino B, factible y de alto impacto visual) + **Word/PPT→PDF por servidor opt-in**
(camino A) hasta que haya demanda.

**Esfuerzo** Excel→PDF cliente ▅ · servidor opt-in ▁ · **Prioridad** ⭐⭐ · **Riesgo**: medio (geometría/
paginación). **Verificación**: hoja con bordes finos/medios/gruesos, fondos de color, negritas y números
formateados → el PDF reproduce grosores, colores y negritas; comparar con la salida de LibreOffice como
referencia.

---

## 9. Arquitectura transversal (sostiene todo lo anterior)

### 9.1 Web Workers como norma para trabajo pesado
Hoy conversión/compresión/layout corren en el hilo de UI. Establecer un **patrón de worker** reutilizable
(`lib/pdf/*.worker.ts` + cliente con Comlink MIT) para: PDF→Office, compresión, OCR, Excel→PDF, redacción.
Beneficio: UI fluida, archivos grandes viables, progreso real, cancelación. **Es el cambio de arquitectura
más rentable del plan** porque desbloquea 4–5 features.

### 9.2 Estrategia de archivos grandes y memoria
- Procesado **por ventanas** de páginas + `cleanup()` agresivo (no retener canvases ni spans de todo el doc).
- **Construcción incremental** de la salida (docx/xlsx/pdf) en streaming.
- **Guardas**: umbral de páginas/bytes con aviso y selección de rango (en vez de colgarse).
- Medir con un PDF de estrés (300–800 págs) como test manual recurrente.

### 9.3 Estrategia WASM + CSP (¡detalle crítico!)
- Solo libros **permisivos** (Apache-2.0/MIT): `qpdf`, `pdfcpu`, `tesseract.js`, `fflate`, `fontkit`.
  **Evitar AGPL** (Ghostscript, MuPDF) para mantener el repo “limpio” de cara a un portfolio/empleo.
- **Autoalojar** los `.wasm` (cumple `script-src 'self'`; cero CDNs) y **lazy-load** por herramienta (no
  inflar el bundle inicial).
- **CSP**: `WebAssembly.instantiate` suele requerir **`'wasm-unsafe-eval'`** en `script-src`. Hay que
  **añadirlo** a la CSP del frontend (sigue siendo seguro: no permite `eval` de JS, solo compilar WASM
  propio). Verificar en el spike de §7/§4 antes de comprometerse.

### 9.4 Presupuestos de rendimiento
- Bundle inicial sin crecer por WASM (todo lazy). Mantener code-splitting por motor (ya existe).
- Objetivo: conversión PDF→Word de doc “normal” (20–30 págs) < 5 s; compresión de doc de imágenes con
  feedback de progreso continuo; nunca bloquear el hilo > 50 ms seguidos (worker).

---

## 10. Roadmap por sprints (secuenciado por dependencias e impacto)

> Orden pensado para que cada sprint **publique algo demostrable** y para construir primero la
> infraestructura (worker, WASM) que el resto reutiliza.

### Sprint 1 — “Arreglar lo que daña la credibilidad” (▃, alto impacto inmediato)
1. **Compresor Capa 1 “smart raster”** (no más mata-texto). §4.3.
2. **Unir con previsualización** y reordenar a nivel de página. §5.
3. **Formularios: fuente + tamaño + preview retina + zoom + copiar/pegar**. §3.
→ Cero libs nuevas, cero riesgo, tapa 3 quejas concretas tuyas.

### Sprint 2 — Infraestructura habilitadora (▃/▅)
4. **Patrón Web Worker** + mover PDF→Office al worker + procesado por ventanas (archivos grandes). §6.3, §9.
5. **Spike WASM bajo CSP** (qpdf/pdfcpu): confirmar paquete, tamaño, `'wasm-unsafe-eval'`. §9.3.
→ Desbloquea seguridad, compresión pro y Excel→PDF.

### Sprint 3 — **Seguridad** (la categoría “killer”, ⭐⭐⭐) §7
6. Proteger / Desproteger / Permisos (WASM).
7. **Redactar de verdad** (rasterizado). 8. **Firmar** (visual, ya hay `SignatureModal`).
9. Sanitizar. → Gran post de LinkedIn: “cifrado y redacción sin que tu archivo salga del navegador”.

### Sprint 4 — Conversión de alto nivel (⭐⭐/⭐⭐⭐)
10. **Compresor Capas 2–3** (estructural WASM + imágenes). §4.
11. **PDF→Word fidelidad** (header/footer, columnas, listas, imágenes flotantes). §6.2.
12. **Excel→PDF con estilos** (cliente, F1) + Word/PPT→PDF servidor opt-in. §8.

### Sprint 5 — Diferenciadores “wow” (⭐⭐)
13. **OCR** local (`tesseract.js`). 14. **Comparar 2 PDF**. 15. **Recortar / N-up**. 16. PDF/A, Reparar.

---

## 11. Registro de riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| WASM bloqueado por CSP `script-src 'self'` | Bloquea seguridad/compresión pro | Spike temprano (Sprint 2); añadir `'wasm-unsafe-eval'`; autoalojar `.wasm`. |
| Tamaño del WASM (Go/pdfcpu varios MB) | Carga lenta | Lazy-load por herramienta; mostrar progreso de descarga; evaluar qpdf (C++) si es más ligero. |
| Licencias AGPL (Ghostscript/MuPDF) | Contamina el repo | Prohibidas; solo Apache-2.0/MIT (§12). |
| Reinyección de imágenes recomprimidas en el PDF | Compresión Capa 3 compleja | Empezar por Capas 1–2 (ya útiles); Capa 3 solo si la API WASM lo facilita. |
| Worker + pdf.js (config `workerSrc`, módulos) | Refactor del flujo de conversión | PoC aislada antes de migrar las 3 conversiones. |
| Fidelidad Excel→PDF (paginación/merges) | Resultados “casi” | Fases F1→F2; LibreOffice como referencia de comparación; servidor opt-in como red de seguridad. |
| Redacción incompleta (texto recuperable) | **Fuga de datos** (grave) | Estrategia conservadora: rasterizar la página entera afectada; test con `pdftotext`. |

---

## 12. Decisiones de librería y licencia

| Necesidad | Librería propuesta | Licencia | Por qué |
|---|---|---|---|
| Cifrado/permisos/optimize/redact estructural | **pdfcpu-wasm** *o* **qpdf-wasm** | Apache-2.0 | Permisiva, autoalojable, cubre varias herramientas. Decidir en spike por tamaño. |
| Descomprimir/leer XLSX (y unificar ZIP) | **fflate** | MIT | Diminuta, sin deps, rápida; puede sustituir `client-zip`+`zipStore`. |
| Fuentes reales incrustadas (forms, Excel→PDF) | **@pdf-lib/fontkit** | MIT | Integración nativa con pdf-lib; subsetting. |
| OCR local | **tesseract.js** | Apache-2.0 | 100% navegador, encaja con la tesis. |
| Worker RPC | **Comlink** | Apache-2.0 | Ergonomía de postMessage; opcional (se puede a mano). |
| **Prohibidas** | Ghostscript, MuPDF/mutool, SheetJS `xlsx` | AGPL / CVE | AGPL contamina; `xlsx` tuvo CVEs (ya rechazada). |

Todas se **lazy-cargan** y se **autoalojan**. Tras añadir cualquiera: `npm audit` debe seguir en **0**.

---

## 13. Puertas de calidad (se aplican a cada PR de este plan)
1. **Funciones puras testeadas en Node** (layout, parsers OOXML, mapeos de estilo) antes de tocar UI.
2. **Validez de ficheros**: `.docx`/`.xlsx`/`.pdf` de salida → `unzip -t`/`xmllint`/`qpdf --check` limpios.
3. **Regresión**: `tsc -b` + `oxlint` + `vite build` + `npm audit (0)` verdes; chunks por motor intactos.
4. **Privacidad**: ninguna herramienta nueva 🟢/🔵 hace peticiones de red con contenido del usuario (revisar
   en cada PR). Las 🟡 (servidor) son **opt-in explícito** con aviso.
5. **Prueba manual en navegador** con corpus real (texto, escaneado, fotos, tablas, formularios, grande).

---

## 14. Resumen ejecutivo (TL;DR)
- **Lo más urgente** no es añadir herramientas, sino **arreglar el compresor** (hoy destruye el texto) y
  **robustecer PDF→Word para archivos grandes** (Web Worker) — son las dos cosas por las que un usuario nos
  abandona por iLovePDF.
- **Lo más estratégico** es **crear la categoría Seguridad** (proteger/redactar/firmar **en el navegador**):
  es donde nuestra promesa de privacidad es *literalmente imposible* de igualar para quien sube el archivo.
- **Lo que pediste en concreto** está todo planificado con técnica real: formularios (fuente/tamaño/zoom/
  copiar §3), compresor pro (§4), preview de Unir (§5), PDF→Word grande (§6), seguridad (§7) y Excel→PDF con
  estilos (§8, vía OOXML + pdf-lib en cliente).
- **El desbloqueo técnico clave** es el **Web Worker + estrategia WASM permisiva bajo CSP** (§9): una vez
  montado, habilita compresión pro, seguridad, OCR y Excel→PDF sin sacrificar la tesis ni las 0
  vulnerabilidades.

**Siguiente paso recomendado:** Sprint 1, empezando por el **compresor “smart raster”** (máximo daño
reputacional reparado con el menor esfuerzo y cero dependencias nuevas).

---

## 15. Estado de implementación (actualizado 2026-06-29)

Todo lo siguiente está **implementado y verificado** (`tsc` + `oxlint` + `vite build` + `npm audit` 0
vulnerabilidades). Las funciones puras se han probado en Node; lo que depende del navegador queda pendiente de
tu prueba.

### ✅ Hecho
- **Sprint 1.1 — Compresor “smart raster”** (§4 Capa 1): solo rasteriza páginas escaneadas; conserva el texto.
- **Sprint 1.2 — Unir con previsualización** a nivel de página (rejilla, reordenar/rotar/quitar).
- **Sprint 1.3 — Formularios pro** (§3): fuente/tamaño/negrita/color/alineación (DA + updateAppearances,
  verificado en Node), preview retina, zoom (Ctrl±/0), copiar/pegar campos.
- **Sprint 2a — PDF→Office archivos grandes** (§6): `PageRange` por los 3 conversores + aviso y selector de
  rango en docs >50 págs.
- **Excel→PDF con estilos** (§8 camino B): on-device, parser OOXML propio + `fflate`; bordes/colores/negritas/
  alineación/merges/numFmt. Test Node 18/18.
- **Seguridad — Sanear PDF** (§7, sin WASM): quita JavaScript, adjuntos y metadatos. Nueva categoría
  “Seguridad”. Test Node 11/11.
- **N-up — varias páginas por hoja** (§2.2): 2/4/6/9, robusto ante páginas en blanco. Test Node 8/8.

### ⏳ Pendiente (requiere tu navegador o una decisión)
- **Web Worker** para PDF→Word grande (§6.3): necesita refactor a `OffscreenCanvas` en
  `extractColors`/`extractGraphics` + pdf.js anidado; se hará con **fallback a hilo principal** y requiere
  prueba en navegador.
- **Seguridad con WASM** (§7): proteger/desproteger con contraseña, permisos, redactar, firmar → decisión de
  añadir `qpdf`/`pdfcpu`-WASM (Apache-2.0) + CSP `'wasm-unsafe-eval'` (spike §9.3).
- **Compresión Capas 2–3** (§4): optimización estructural + recompresión de imágenes (WASM).
- **Word/PPT→PDF**: servidor Gotenberg opt-in (ya existe la ruta).
