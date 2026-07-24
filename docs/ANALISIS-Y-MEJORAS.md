# DocLab — Análisis del código y propuesta de mejoras (último tramo)

> Revisión técnica, de UX y de seguridad del proyecto completo. 2026-07-02.
> Objetivo: cerrar el desarrollo con un producto sólido, seguro y mantenible. Cada punto lleva su
> **esfuerzo** (▁ bajo · ▃ medio · ▅ alto) y **prioridad** (⭐⭐⭐ / ⭐⭐ / ⭐).

---

## 0. Lo que YA está sólido (no tocar)
- **Backend seguro y minimalista**: helmet CSP restrictiva, CORS allowlist por env, rate-limit global + por
  endpoint, subida **solo en memoria** (cero disco), validación por **magic bytes**, config con **zod fail-fast**,
  `x-powered-by` desactivado, `trust proxy` para IP real. Muy bien.
- **IA (Gemini) bien acotada**: solo viaja la consulta + catálogo público (nunca archivos); salida **validada**
  (solo ids del catálogo, `answer` recortada). Sin `dangerouslySetInnerHTML` en todo el frontend → sin XSS.
- **Frontend**: CSP `script-src 'self' 'wasm-unsafe-eval'`, WASM/OCR **autoalojados** (nada de CDNs), **0
  vulnerabilidades** (`npm audit`), code-splitting por herramienta (chunks perezosos), tesis local-first intacta.
- **23 herramientas activas** + 4 "en desarrollo" (Office). Cobertura amplia y coherente.

---

## 1. Seguridad

### 1.1 Eliminar el backend muerto de Gotenberg ⭐⭐⭐ ▁
`frontend/src/lib/api.ts` (Office→PDF vía Gotenberg) **no lo usa nadie** (confirmado por grep). Arrastra una
superficie de ataque e infraestructura innecesarias:
- **Backend**: ruta `routes/convert.ts`, `services/gotenberg.ts`, `middleware/upload.ts`, y las deps
  `multer`, `file-type`, `form-data`, `axios` (solo servían a Gotenberg).
- **Infra**: el servicio `gotenberg` de `docker-compose.yml` (un contenedor menos que mantener/exponer).
- **Frontend**: `lib/api.ts`.
→ **Propuesta**: borrarlo. El backend queda como **proxy de IA opcional** (`/health` + `/assistant/search`). Menos
código, menos deps, menos superficie. (Si algún día se hace el modo "alta fidelidad opt-in", se reintroduce el
microservicio adecuado —pdf2docx— de forma limpia.)

### 1.2 Endurecer cabeceras del frontend (nginx) ⭐⭐ ▁
Añadir a `frontend/nginx.conf`: `Permissions-Policy` restrictiva (deshabilitar cámara, micrófono, geolocalización,
usb…), `Cross-Origin-Opener-Policy: same-origin`, `X-Frame-Options: DENY` (ya cubierto por CSP frame-ancestors,
pero belt-and-suspenders). Mantener `Referrer-Policy: no-referrer`.

### 1.3 Revisión WASM bajo CSP (pendiente de navegador) ⭐⭐ ▁
qpdf-wasm (cifrado) y tesseract (OCR) necesitan `'wasm-unsafe-eval'` (ya añadido) y fetch same-origin (ya
autoalojados). **Falta confirmar en navegador real** que compilan/ejecutan bajo la CSP de producción (nginx).
Es la única pieza de seguridad no verificada end-to-end.

---

## 2. Arquitectura / técnico

### 2.1 Web Workers para el trabajo pesado ⭐⭐⭐ ▅ (la mayor deuda técnica)
Hoy TODO el trabajo pesado corre en el **hilo principal** → la UI se **congela** con archivos grandes:
análisis de estructura, conversiones, compresión, redacción y sobre todo **OCR** (lento, ahora la herramienta
estrella pesada). **Propuesta**: patrón reutilizable `lib/pdf/*.worker.ts` + cliente (Comlink MIT o postMessage)
para mover fuera del hilo: OCR, compresión, redacción y el análisis de estructura. Con `OffscreenCanvas` para el
render. Beneficio: UI fluida, progreso real, cancelación, archivos grandes viables. **Empezar por OCR** (mayor
dolor). Riesgo: pdf.js como worker anidado + `OffscreenCanvas` en `extractColors`/`extractGraphics` → hacer con
**fallback a hilo principal**.

### 2.2 Tests en el frontend (vitest) ⭐⭐⭐ ▃
El frontend **no tiene runner de tests**. Toda la lógica pura se ha ido verificando con scripts Node de usar y
tirar (borrados) → **nada evita regresiones** (y ya sufrimos una en PDF→Word). **Propuesta**: añadir `vitest` +
persistir como tests reales las funciones puras ya probadas: `structure/{layout(detectAlign),
detectTablesStream, detectHeaderFooter, util}`, `wordDiff`, `office/{xml,xlsxModel}`, `optimizeImages`
(decode/isDct), `forms` (DA), `nup`, `secure` (sanitize). Es la inversión de mayor retorno para *estabilidad*.

### 2.3 Utilidades compartidas (DRY) ⭐⭐ ▃
Duplicación del patrón "renderizar página pdf.js → canvas → JPEG": aparece en `compress.ts`, `redact.ts`,
`makeSearchable.ts` (y parte en `ocrPage`). **Propuesta**: extraer `lib/pdf/renderPage.ts`
(`renderPageToCanvas(page, scale)`, `canvasToJpeg(canvas, q)`) y la **capa de texto invisible** (usada en redact
y makeSearchable) a un helper común. Menos bugs, más coherencia.

### 2.4 Documentar el pipeline `structure/*` ⭐ ▁
Es el módulo más complejo (spans → líneas → bloques → tablas → docx) y el que más ha sufrido. Un
`docs/PIPELINE-STRUCTURE.md` con el flujo y los invariantes evita romperlo al tocarlo.

---

## 3. UX / accesibilidad

### 3.1 ErrorBoundary / recuperación ante fallos ⭐⭐⭐ ▁
`router.tsx` **no define `errorElement`** y no hay ErrorBoundary. Si un motor lanza en render, el usuario ve una
pantalla rota. **Propuesta**: `errorElement` en las rutas + un `<ErrorBoundary>` alrededor del `<ToolEngine>` con
mensaje amable ("Algo falló con este archivo; prueba otro / recarga") y botón de recuperación. Crítico dada la
naturaleza "cada PDF es distinto" del producto.

### 3.2 Consistencia de estados ⭐⭐ ▃
Cada herramienta implementa a su manera cargando/error/progreso/vacío. **Propuesta**: primitivos compartidos
(`<ToolBusy>`, `<ToolError>`, `<ProgressBar>`, `<EmptyState>`) para una experiencia uniforme y menos código.

### 3.3 Accesibilidad ⭐⭐ ▃
- **Herramientas de arrastre** (Formularios, Censura, Unir) no tienen alternativa por teclado para crear/mover
  cajas → inaccesibles con teclado. Añadir atajos/inputs numéricos (Formularios ya tiene panel XYWH; replicar).
- Auditar **foco visible**, `aria-label` en iconos-botón, roles de las rejillas, contraste, y respetar
  `prefers-reduced-motion` (hay varias transiciones/animaciones).

### 3.4 Móvil ⭐⭐ ▃
Las herramientas de lienzo ancho (Editor, Formularios, Censura, Unir) necesitan una revisión en pantallas
pequeñas (el layout de dos paneles y el zoom). Definir el comportamiento mínimo en móvil.

### 3.5 OCR: primera ejecución ⭐⭐ ▁
La 1ª vez, OCR descarga el modelo de idioma (~1-2 MB) y es lento. Mostrar un aviso claro ("preparando el motor
de OCR la primera vez…") + **cancelar**. Ya hay barra de progreso por página; añadir el estado de carga inicial.

### 3.6 Catálogo: separar "en desarrollo" ⭐ ▁
Las 4 tarjetas Office ("En desarrollo") aparecen mezcladas. Agruparlas al final o bajo un encabezado "Próximamente"
para que no compitan con las que funcionan.

---

## 4. Salud del código

### 4.1 Assets de Tesseract fuera de git ⭐⭐ ▁
`public/tesseract/` = **8.7 MB** commiteados (worker + core .wasm + modelos). **Propuesta**: `.gitignore` +
script `npm run setup:ocr` que copie el worker/core de `node_modules` y descargue los `traineddata`. Repo limpio
y reproducible; los assets se generan en install/build.

### 4.2 Warnings de lint ⭐ ▁
Quedan 4 warnings `unicorn(no-new-array)` en `office/xlsxToPdf.ts` (`new Array(n).fill(x)` → `Array.from`).
Triviales; dejar el lint en **cero warnings**.

### 4.3 Código "aparcado" (Office) — OK
Los motores/componentes Office siguen en el registry con `available:false`. Es intencional ("en desarrollo"), no
es deuda. Solo conviene una nota en el código de por qué están parkeados (enlazar la decisión).

---

## 5. Rendimiento
- **Bundle** bien troceado (lazy por herramienta); los chunks grandes (pdfjs ~420 KB, docx/pptx ~370 KB) solo se
  cargan al abrir su herramienta. OK.
- El **worker de tesseract** descarga el modelo una vez y lo cachea. OK.
- La mayor palanca de rendimiento **percibido** es la §2.1 (Web Workers): mover el cómputo fuera del hilo.

---

## 6. Roadmap propuesto (secuenciado)

### Tanda 1 — "Quick wins" (todo ▁, alto valor, bajo riesgo) — ✅ HECHA (2026-07-05)
1. ✅ **ErrorBoundary** (`components/ErrorBoundary.tsx` en ToolPage + `pages/RouteError.tsx` como errorElement).
2. ✅ **Eliminado Gotenberg muerto**: borrados `routes/convert`, `services/gotenberg`, `middleware/upload`,
   `lib/api.ts`; deps `axios/file-type/form-data/multer/@types-multer` desinstaladas; `docker-compose.yml` (dev)
   borrado y `prod` sin gotenberg. Backend = solo proxy IA. tsc + 13 tests verdes.
3. ✅ **Tesseract fuera de git**: `.gitignore` + `scripts/setup-ocr.mjs` + `postinstall`/`setup:ocr`.
4. ✅ **Cabeceras nginx**: ya estaban muy endurecidas (Permissions-Policy/COOP/CORP/HSTS); +usb/payment.
5. ✅ **Lint a cero** (xlsxToPdf) + utilidad compartida **`lib/pdf/renderPage.ts`** (DRY en compress/redact/
   makeSearchable). Verificado: tsc + oxlint (0 warnings) + build + `npm audit` 0.

### Tanda 2 — Estabilidad y UX (▃) — ✅ HECHA (2026-07-07)
6. ✅ **Tests en frontend (vitest)**: `vitest.config.ts` (separado de `vite.config.ts` para evitar el choque
   de tipos de plugins), scripts `test`/`test:watch`. **51 tests / 11 archivos** sobre funciones puras:
   `structure/{layout,detectTablesStream,detectHeaderFooter,util}`, `wordDiff`, `office/{xml,xlsxModel}`,
   `optimizeImages` (isDct/isFlateOnly), `nup`, `secure` (sanitize), `forms` (addFields/readFields/fill).
   Bloquean las regresiones que más dolieron (viñetas≠tabla, justify con sangría, crash de spans corruptos).
7. ✅ **Primitivo `<ProgressBar>`** compartido (`components/ui.tsx`) con `role="progressbar"` + `aria-valuenow`
   y variante indeterminada; adoptado en OCR/Office/Compress/PdfToText/PdfToImages. **Accesibilidad**: red de
   seguridad global `prefers-reduced-motion: reduce` en `index.css` (además de las reglas por-componente); el
   `:focus-visible` ya existía.
8. ✅ **OCR primera-ejecución + cancelar**: aviso "Preparando el motor de OCR…" (fase `preparing` propagada
   desde `ocr.ts`→`makeSearchable`) + botón **Cancelar** (AbortSignal, corte cooperativo entre páginas).
   Catálogo: `getToolsByCategory` agrupa las tarjetas "en desarrollo" (`available:false`) al final (estable).

### Tanda 3 — La gran mejora técnica (▅) — ✅ PARCIAL (2026-07-07)
9. ✅ **Web Worker para seguridad (qpdf)**: núcleo compartido `secureWasmCore.ts` + `secureWasm.worker.ts`
   (módulo Vite) + despachador en `secureWasm.ts` con **fallback transparente al hilo principal** si el worker
   no está disponible o no puede cargar el WASM (distingue error de *infra* vs error de *proceso* para no
   duplicar cómputo). Corregido de paso el **footgun de `add_header` de Nginx**: el bloque `/assets/` perdía
   TODAS las cabeceras de seguridad heredadas (CSP, nosniff, COOP/CORP) → repetidas ahí para que el JS/WASM con
   hash (incl. el worker) las lleve. CSP ya tenía `worker-src 'self' blob:`.
   - ⏳ **Pendiente (requiere verificación en navegador, no lo hago a ciegas)**: mover OCR/compresión/estructura
     a workers con `OffscreenCanvas`. El render pesado (pdf.js→canvas) y `OffscreenCanvas` en
     `extractColors`/`extractGraphics` no son verificables sin navegador; se dejan documentados con la pauta de
     "fallback a hilo principal" ya establecida por el worker de seguridad.

### Cierre
10. Revisión **móvil** (§3.4) + `docs/PIPELINE-STRUCTURE.md` (§2.4) + verificación WASM en navegador real (§1.3).

---

## Recomendación
Empezar por la **Tanda 1** (todo bajo riesgo y alto valor: robustez ante fallos + limpieza de superficie de
ataque + repo más ligero) y la **§2.2 (tests)** en paralelo, porque es lo que evita repetir las regresiones que
más frustración han causado. La §2.1 (Web Workers) es la joya técnica del cierre, pero requiere prueba en
navegador, así que va la última.
