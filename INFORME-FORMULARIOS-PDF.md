# DocLab — Especificación Completa: Herramienta de Formularios PDF

> **Fecha:** 28 de junio de 2026
> **Objetivo:** Documentar en detalle la herramienta de Formularios PDF de DocLab, que debe cubrir tres modos de uso: **rellenar formularios existentes**, **crear formularios interactivos desde cero**, y **detectar campos automáticamente con IA**. Se toman como referencia las plataformas ILovePDF, Adobe Acrobat, Jotform y DocuSign.
> **Procesamiento:** 100% en el navegador (on-device) para rellenar y crear formularios. La detección con IA puede usar opcionalmente la API de Gemini.
> **Tecnología base:** `pdf-lib` (crear/modificar AcroForms), `pdf.js` (renderizar y leer campos existentes), TypeScript + React.

---

## Tabla de Contenidos

1. [Visión General y Arquitectura](#1-visión-general-y-arquitectura)
2. [Modo 1: Rellenar Formulario](#2-modo-1-rellenar-formulario)
3. [Modo 2: Crear / Editar Formulario](#3-modo-2-crear--editar-formulario)
4. [Modo 3: Detectar Campos con IA](#4-modo-3-detectar-campos-con-ia)
5. [Tipos de Campo Soportados](#5-tipos-de-campo-soportados)
6. [Panel de Propiedades del Campo](#6-panel-de-propiedades-del-campo)
7. [Validación y Lógica Condicional](#7-validación-y-lógica-condicional)
8. [Exportación y Formatos de Salida](#8-exportación-y-formatos-de-salida)
9. [Firma Electrónica Integrada](#9-firma-electrónica-integrada)
10. [Experiencia de Usuario Detallada](#10-experiencia-de-usuario-detallada)
11. [Accesibilidad](#11-accesibilidad)
12. [Casos de Uso Objetivo](#12-casos-de-uso-objetivo)

---

## 1. Visión General y Arquitectura

### 1.1 Concepto

La herramienta de Formularios PDF es un editor visual que permite al usuario interactuar con documentos PDF de tres maneras fundamentales:

| Modo | Público objetivo | Acción |
|:-----|:-----------------|:-------|
| **Rellenar** | Usuario final | Abre un PDF con campos AcroForm existentes y los rellena visualmente |
| **Crear / Editar** | Creador del formulario | Diseña un formulario arrastrando campos sobre un PDF cualquiera |
| **Detectar con IA** | Usuario con formularios legacy | La IA escanea un PDF plano/escaneado y sugiere dónde colocar campos |

### 1.2 Arquitectura técnica

```
┌──────────────────────────────────────────────────────────┐
│                    NAVEGADOR (client-side)                │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  pdf.js   │    │ pdf-lib  │    │  Gemini API      │   │
│  │ Renderizar│    │ Crear    │    │ (opcional)       │   │
│  │ + leer    │    │ AcroForms│    │ Detectar campos  │   │
│  │ campos    │    │          │    │                  │   │
│  └─────┬─────┘    └────┬─────┘    └────────┬─────────┘   │
│        │               │                   │             │
│        └───────────┬───┘                   │             │
│                    ▼                       │             │
│  ┌──────────────────────────────────────┐  │             │
│  │         FormsTool.tsx                 │◄─┘             │
│  │   (React Component — modo selector)  │                │
│  │   ┌────────┐ ┌────────┐ ┌─────────┐ │                │
│  │   │ Fill   │ │ Build  │ │ Detect  │ │                │
│  │   │ Mode   │ │ Mode   │ │ Mode    │ │                │
│  │   └────────┘ └────────┘ └─────────┘ │                │
│  └──────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

### 1.3 Registro en el catálogo

La herramienta se registrará con dos tarjetas en el catálogo:

1. **"Rellenar formulario PDF"** — Categoría: Editar — Flujo directo al modo Fill.
2. **"Crear formulario PDF"** — Categoría: Editar — Flujo directo al modo Build con opción de Detect.

Ambas comparten el mismo `engineId: 'forms'` y componente `FormsTool.tsx`, diferenciadas por `preset.mode`.

---

## 2. Modo 1: Rellenar Formulario

### 2.1 Propósito

Permitir al usuario abrir un PDF que ya contiene campos interactivos (AcroForms) y rellenarlos visualmente, como si estuviera escribiendo en un formulario en papel pero en digital.

### 2.2 Flujo completo del usuario

```
[1. Subir PDF] → [2. Detectar campos AcroForm] → [3. Renderizar PDF con campos editables]
     → [4. El usuario rellena los campos] → [5. Guardar / Descargar PDF rellenado]
```

### 2.3 Detección y renderizado de campos existentes

**Qué:** Al cargar un PDF, el sistema debe detectar automáticamente todos los campos AcroForm que ya existan en el documento y renderizarlos como inputs HTML interactivos superpuestos sobre la imagen de la página.

**Cómo debe funcionar:**

1. **Lectura con `pdf.js`:** Al cargar los bytes del PDF, usar `pdfDoc.getPage(n)` y luego `page.getAnnotations()` para obtener todas las anotaciones de tipo widget (campos de formulario).
2. **Mapeo de tipos:** Cada campo AcroForm tiene un tipo. Se mapea al input HTML correspondiente:
   - `Tx` (Text) → `<input type="text">` o `<textarea>` (si es multilínea).
   - `Btn` con flag checkbox → `<input type="checkbox">`.
   - `Btn` con flag radio → `<input type="radio">`.
   - `Ch` (Choice) → `<select>` con `<option>` por cada valor.
   - `Sig` (Signature) → Zona clicable que abre el `SignatureModal`.
3. **Posicionamiento:** Cada campo se posiciona como un `<div>` con `position: absolute` sobre la imagen renderizada de la página, usando las coordenadas `rect` del campo (convertidas al sistema de coordenadas del display con el factor de escala del renderizado).
4. **Estilo de los campos:** Los inputs superpuestos deben tener:
   - Fondo semitransparente azul muy claro (`rgba(15, 181, 166, 0.06)`) para que el usuario identifique dónde están los campos rellenables.
   - Borde de `1px solid rgba(15, 181, 166, 0.3)`.
   - Al hacer hover: el fondo se intensifica a `rgba(15, 181, 166, 0.12)` y el borde a `rgba(15, 181, 166, 0.6)`.
   - Al obtener el foco: borde sólido `var(--signal)` con `box-shadow: 0 0 0 3px rgba(15, 181, 166, 0.15)`.
   - Tipografía que coincida con la especificada en el campo AcroForm (fuente, tamaño, color). Si no está definida, usar Helvetica 11pt negro.
5. **Valores existentes:** Si el campo ya tiene un valor rellenado, se muestra como placeholder o como valor inicial editable.
6. **Tab order:** Los campos se ordenan por su `tabIndex` definido en el PDF, o si no existe, de arriba a abajo, izquierda a derecha. El usuario puede navegar entre campos con `Tab` y `Shift+Tab`.

### 2.4 Indicadores de estado de los campos

**Qué:** Cada campo debe comunicar visualmente al usuario si es obligatorio, si ya está rellenado, y si hay errores de validación.

**Cómo debe funcionar:**

- **Campo obligatorio sin rellenar:** Borde izquierdo de 3px en `var(--ember)` (rojo suave). Un asterisco `*` sutil al lado de la etiqueta del campo (si la tiene).
- **Campo rellenado correctamente:** Borde izquierdo de 3px en `var(--signal)` (teal). Un checkmark diminuto (`✓`, 10px) en la esquina superior derecha del campo.
- **Campo con error de validación:** Borde completo en `var(--ember)`, fondo `rgba(217, 45, 32, 0.05)`. Un tooltip debajo con el mensaje de error: `"Este campo es obligatorio"`, `"Formato de email inválido"`, etc.
- **Campo de solo lectura:** Fondo gris claro (`var(--ink)/3`), cursor `not-allowed`, sin borde de interacción.

### 2.5 Barra de progreso de completado

**Qué:** Una barra de progreso en la parte superior que muestra cuántos campos obligatorios se han rellenado del total.

**Cómo debe funcionar:**

- Barra horizontal delgada (4px) en la parte superior del área de trabajo, ancho completo.
- Color: gradiente de `var(--ember)` (0%) a `var(--signal)` (100%) conforme se rellenan campos.
- Texto debajo de la barra: `"7 de 12 campos obligatorios completados"`.
- Al llegar al 100%, la barra hace un flash de brillo y cambia a verde sólido con el texto `"✅ Formulario completo"`.
- Los campos opcionales no cuentan en el progreso pero se indican como `"+ 3 opcionales"`.

### 2.6 Navegación entre campos

**Qué:** Un panel lateral compacto que lista todos los campos del formulario con su estado, permitiendo saltar directamente a cualquiera.

**Cómo debe funcionar:**

- Un panel colapsable de 240px de ancho en el lado derecho.
- Lista vertical de todos los campos, agrupados por página:
  ```
  Página 1
    ✓ Nombre completo     [Juan García]
    ✓ Email               [juan@email.com]
    ⚠ Teléfono            [vacío]
    ─ Comentarios         [opcional]
  Página 2
    ⚠ Firma               [sin firmar]
  ```
- **Iconos de estado:** `✓` verde (rellenado), `⚠` naranja (obligatorio vacío), `─` gris (opcional).
- **Clic en un item:** Hace scroll a la página correspondiente y enfoca el campo con un flash de highlight (borde pulsante 2 veces en 600ms).
- **Filtros rápidos:** Botones `[Todos] [Vacíos] [Con errores]` para filtrar la lista.

### 2.7 Auto-rellenado inteligente

**Qué:** Funcionalidad que permite al usuario guardar un "perfil" de datos personales y auto-rellenar campos comunes en cualquier formulario futuro.

**Cómo debe funcionar:**

- Al rellenar un formulario, el sistema detecta campos comunes por su nombre AcroForm o por heurística de etiquetas: `name`, `email`, `phone`, `address`, `date`, `company`, `dni`, `nif`.
- Un botón en la barra superior: `"⚡ Auto-rellenar con mi perfil"`.
- La primera vez, abre un modal donde el usuario introduce sus datos personales (nombre, email, teléfono, dirección, empresa, NIF/DNI). Estos datos se almacenan **exclusivamente en `localStorage`** (nunca salen del navegador).
- En formularios futuros, el botón rellena automáticamente los campos coincidentes y resalta los campos rellenados con un flash azul breve (200ms).
- El usuario puede editar su perfil en cualquier momento desde un enlace `"Editar mi perfil ⚙️"`.
- Un badge de privacidad: `"🔒 Tu perfil se guarda solo en este navegador"`.

### 2.8 Guardado del formulario rellenado

**Qué:** El usuario guarda el PDF con los valores rellenados incrustados en los campos AcroForm.

**Cómo debe funcionar:**

- Botón principal: `"Guardar PDF rellenado"`.
- **Opción 1 — Editable:** Guarda el PDF con los campos AcroForm intactos (el receptor puede seguir editándolos en Adobe Reader u otro visor). Este es el modo por defecto.
- **Opción 2 — Aplanado (flatten):** Guarda el PDF con los valores "quemados" como texto estático (los campos desaparecen y los valores se incrustan como contenido de la página). Un toggle: `"☐ Aplanar formulario (los campos no serán editables)"`.
- El aplanado se ejecuta con `form.flatten()` de `pdf-lib`.
- **Validación antes de guardar:** Si hay campos obligatorios vacíos, mostrar un modal de confirmación: `"Hay 3 campos obligatorios sin rellenar. ¿Quieres guardar de todos modos?"` con botones `[Guardar igualmente] [Volver al formulario]`.

---

## 3. Modo 2: Crear / Editar Formulario

### 3.1 Propósito

Permitir al usuario tomar cualquier PDF (un documento plano, un escaneo, una plantilla diseñada en Word) y convertirlo en un formulario interactivo colocando campos rellenables sobre él de forma visual.

### 3.2 Flujo completo del usuario

```
[1. Subir PDF base] → [2. Renderizar como fondo] → [3. Arrastrar campos desde el panel]
     → [4. Posicionar y configurar cada campo] → [5. Probar en modo preview]
     → [6. Exportar como PDF interactivo]
```

### 3.3 Interfaz del constructor (Build Mode)

**Layout general:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Modo: Rellenar | Crear | Detectar IA]    [Preview] [Guardar] │
├────────┬────────────────────────────────────────┬───────────┤
│        │                                        │           │
│ PANEL  │          LIENZO                        │ PANEL     │
│ DE     │    (PDF renderizado como fondo          │ DE        │
│ CAMPOS │     + campos superpuestos               │ PROPIED.  │
│        │     arrastrables)                       │           │
│ [Aa]   │                                        │ Nombre:   │
│ [☑]   │    ┌─────────────────────┐             │ [campo1]  │
│ [◉]   │    │  Nombre: [________]│             │           │
│ [▾]   │    │  Email:  [________]│             │ Tipo:     │
│ [📅]  │    │  ☐ Acepto         │             │ [Texto ▾]│
│ [✍]   │    │                    │             │           │
│ [📎]  │    └─────────────────────┘             │ Requerido │
│        │                                        │ [✓]       │
├────────┴────────────────────────────────────────┴───────────┤
│  Zoom: [−] 100% [+]  │  Página 1/3  [◀] [▶]               │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Panel de campos (lado izquierdo)

**Qué:** Un panel lateral que contiene todos los tipos de campos disponibles, organizados visualmente para arrastrar al lienzo.

**Cómo debe funcionar:**

- **Ancho:** 180px, fondo `var(--paper-raised)`, borde derecho `var(--line)`.
- **Contenido:** Lista vertical de tipos de campos, cada uno representado como una "tarjeta" arrastrable de 160×40px con icono + nombre:

  | Icono | Nombre | Descripción al hover |
  |:------|:-------|:--------------------|
  | `Aa` | Campo de texto | Entrada de texto de una línea |
  | `¶` | Área de texto | Entrada de texto multilínea |
  | `☑` | Casilla de verificación | Checkbox (sí/no) |
  | `◉` | Selección única | Radio buttons (una opción de varias) |
  | `▾` | Lista desplegable | Dropdown / combo box |
  | `📅` | Fecha | Selector de fecha |
  | `✍` | Firma | Zona de firma manuscrita |
  | `📎` | Archivo adjunto | Zona para adjuntar un archivo |
  | `#` | Número | Campo numérico con validación |
  | `@` | Email | Campo de email con validación |
  | `📞` | Teléfono | Campo de teléfono con formato |
  | `🏷️` | Etiqueta | Texto estático (no editable, decorativo) |

- **Comportamiento de arrastre:**
  1. El usuario hace clic y mantiene pulsado sobre una tarjeta de campo.
  2. Un "fantasma" del campo sigue al cursor (con `opacity: 0.6`, borde punteado, tamaño predeterminado de 200×32px para texto, 20×20px para checkbox, etc.).
  3. Al pasar sobre el lienzo (la página del PDF), se muestra una línea de guía horizontal y vertical para ayudar a posicionar el campo.
  4. Al soltar, el campo se crea en esa posición con las dimensiones predeterminadas.
  5. Inmediatamente se selecciona el campo recién creado y se abre el panel de propiedades con el cursor en el campo "Nombre".

- **Alternativa sin arrastre:** Hacer clic (sin arrastrar) en una tarjeta de campo activa el "modo colocación": el cursor cambia a `crosshair` y el usuario hace clic en la página para colocar el campo. Hacer clic y arrastrar sobre la página dibuja el rectángulo del campo con las dimensiones deseadas.

### 3.5 Lienzo (zona central)

**Qué:** La zona principal donde se ve el PDF de fondo con los campos superpuestos.

**Cómo debe funcionar:**

- **Renderizado del PDF:** Cada página se renderiza con `pdf.js` a la resolución del viewport (con factor ×2 para retina). Las páginas se muestran en scroll vertical, separadas por 24px.
- **Campos superpuestos:** Cada campo es un `<div>` con `position: absolute` dentro del contenedor de la página. Los campos tienen:
  - Borde de `2px dashed var(--signal)` cuando no están seleccionados.
  - Borde de `2px solid var(--signal)` con handles de redimensionado cuando están seleccionados.
  - Un label flotante sobre el campo con el nombre del campo en `font-size: 10px`, `background: var(--signal)`, `color: white`, `padding: 1px 6px`, `border-radius: 4px 4px 0 0`.
  - Un icono del tipo de campo en la esquina superior izquierda (dentro del label): `Aa`, `☑`, `◉`, `▾`, etc.
- **Selección:** Clic en un campo lo selecciona (borde sólido, handles de esquina, panel de propiedades se actualiza).
- **Multi-selección:** `Shift+clic` para añadir campos a la selección. Lazo de selección (marquee) al hacer clic en zona vacía y arrastrar.
- **Mover campos:** Arrastrar un campo seleccionado lo mueve. Se muestran guías de alineación (snap) relativas a otros campos y a los bordes/centro de la página.
- **Redimensionar campos:** Handles de esquina y de borde medio permiten cambiar el tamaño del campo. Se mantienen las proporciones si se arrastra desde una esquina con `Shift` pulsado.
- **Copiar y pegar:** `Ctrl+C` / `Ctrl+V` copia el campo seleccionado con sus propiedades y lo pega desplazado 12px abajo y a la derecha.
- **Eliminar:** `Delete` o `Backspace` elimina el campo seleccionado (con toast de deshacer de 5 segundos).
- **Deshacer / Rehacer:** `Ctrl+Z` / `Ctrl+Y` con stack de 100 estados.

### 3.6 Alineación y distribución de campos

**Qué:** Herramientas para alinear y distribuir uniformemente los campos seleccionados.

**Cómo debe funcionar:**

- **Guías de alineación automáticas (snap):** Al mover un campo, se muestran líneas de guía cuando:
  - El borde del campo coincide con el borde de otro campo (alineación de bordes).
  - El centro del campo coincide con el centro de otro campo o con el centro de la página.
  - La separación entre campos es uniforme (guías de distribución equidistante con indicadores de distancia en px).
  - Umbral de snap: 6px. Se desactiva temporalmente con `Alt` pulsado.

- **Botones de alineación (aparecen con ≥ 2 campos seleccionados):**
  - `Alinear izquierda` → Todos los campos alinean su borde izquierdo con el campo más a la izquierda.
  - `Alinear centro horizontal` → Los centros horizontales se igualan.
  - `Alinear derecha` → Borde derecho alineado.
  - `Alinear arriba` → Bordes superiores alineados.
  - `Alinear centro vertical` → Centros verticales igualados.
  - `Alinear abajo` → Bordes inferiores alineados.
  - `Distribuir horizontal` → Espaciado uniforme horizontal entre campos.
  - `Distribuir vertical` → Espaciado uniforme vertical.

- **Snapping a grid:** Un grid de fondo opcional (toggle con `Ctrl+G`) con celdas de 10px × 10px, visualizado como puntos sutiles de opacidad 0.08. Los campos hacen snap a las intersecciones del grid.

### 3.7 Duplicación rápida de campos

**Qué:** Funcionalidades para crear campos repetitivos de forma rápida (ej: 10 campos de texto iguales para una lista).

**Cómo debe funcionar:**

- **Duplicar individual:** `Ctrl+D` duplica el campo seleccionado con offset de +12px en X e Y. El nombre del campo se auto-incrementa: si el original es `campo_1`, el duplicado será `campo_2`.
- **Duplicar en serie:** Al tener un campo seleccionado, un botón en el panel de propiedades `"Duplicar en serie ×N"` abre un popover:
  - Número de copias: `[5]` (slider 1-20).
  - Dirección: `[↓ Vertical] [→ Horizontal]`.
  - Espaciado: `[8px]` (slider 0-40px).
  - Preview en vivo: al ajustar los valores, se muestran fantasmas translúcidos de los campos que se crearán.
  - Botón `"Crear"`: inserta todos los campos de una vez.
  - Los nombres se auto-incrementan: `item_1`, `item_2`, …, `item_5`.

### 3.8 Modo Preview (prueba del formulario)

**Qué:** Un modo que permite al creador probar el formulario como lo vería un usuario final, sin salir del editor.

**Cómo debe funcionar:**

- **Activación:** Botón `"👁️ Vista previa"` en la barra superior. Atajo: `Ctrl+P`.
- **Comportamiento:**
  - Los bordes punteados de los campos desaparecen.
  - Los campos se comportan como inputs reales: el usuario puede escribir, marcar checkboxes, seleccionar opciones de dropdown, etc.
  - Los labels del tipo de campo desaparecen.
  - El panel de campos y el panel de propiedades se ocultan.
  - La barra de progreso de completado aparece (si hay campos obligatorios).
  - La validación se ejecuta en tiempo real.
- **Barra de modo preview:** Una barra fija azul en la parte superior: `"🔍 Modo vista previa — Los cambios no se guardan | [Salir de vista previa]"`.
- **Salida:** Botón `"Salir de vista previa"` o `Escape`. Los valores escritos en preview se descartan y se vuelve al modo edición.

---

## 4. Modo 3: Detectar Campos con IA

### 4.1 Propósito

Permitir al usuario subir un PDF plano (no interactivo) — como un formulario escaneado, un PDF generado desde Word, o una imagen de un formulario en papel — y que la IA detecte automáticamente dónde deberían ir los campos interactivos.

### 4.2 Flujo completo del usuario

```
[1. Subir PDF plano] → [2. IA analiza el documento] → [3. Campos sugeridos se muestran]
     → [4. Usuario revisa/acepta/modifica] → [5. Continúa en modo Build]
```

### 4.3 Análisis con la API de Gemini

**Qué:** Enviar la imagen renderizada de cada página del PDF a la API de Gemini (modelo de visión) con un prompt que pida identificar los campos del formulario.

**Cómo debe funcionar:**

1. **Renderizado de página:** Renderizar cada página a una imagen de 1200px de ancho con `pdf.js`.
2. **Envío a Gemini Vision:** Enviar la imagen con el siguiente prompt (en inglés para mejor rendimiento del modelo):

   ```
   Analyze this form page image. Identify all fillable form fields.
   For each field, return a JSON array with:
   - "label": the text label next to the field (e.g., "Full Name", "Email")
   - "type": one of "text", "textarea", "checkbox", "radio", "dropdown", "date", "signature", "email", "phone", "number"
   - "required": boolean, true if the field appears mandatory (marked with *, "required", etc.)
   - "x": left position as percentage of page width (0-100)
   - "y": top position as percentage of page height (0-100)
   - "width": field width as percentage of page width
   - "height": field height as percentage of page height
   - "options": for radio/dropdown, array of option labels
   - "confidence": 0.0 to 1.0, how confident you are in this detection
   
   Return ONLY the JSON array, no explanation.
   ```

3. **Parseo de la respuesta:** Parsear el JSON devuelto por Gemini. Convertir los porcentajes a coordenadas absolutas basándose en las dimensiones de la página.
4. **Creación de campos candidatos:** Cada campo detectado se crea como un "campo candidato" (no confirmado), visualmente diferente de un campo confirmado.

### 4.4 Interfaz de revisión de sugerencias

**Qué:** Los campos sugeridos por la IA se muestran sobre el PDF con un estilo diferente, y el usuario puede aceptarlos, rechazarlos o editarlos individualmente.

**Cómo debe funcionar:**

- **Estilo de campo candidato (no confirmado):**
  - Borde de `2px dashed #f59e0b` (ámbar/naranja) en vez del teal de los campos confirmados.
  - Fondo `rgba(245, 158, 11, 0.08)`.
  - Label: fondo ámbar con texto blanco, incluyendo un indicador de confianza: `"Nombre ✦ 95%"` o `"Teléfono ✦ 62%"`.
  - Si la confianza es < 70%, el borde parpadea suavemente (animación pulse de 2s).

- **Acciones por campo candidato:**
  - **Aceptar (✓):** Botón verde en la esquina superior derecha del campo. Al hacer clic, el campo cambia a estilo confirmado (borde teal sólido). Animación: el borde muta de ámbar a teal con una transición de 300ms.
  - **Rechazar (✕):** Botón rojo en la esquina del campo. El campo se desvanece con una animación de `scale: 1 → 0.8` + `opacity: 1 → 0` en 200ms.
  - **Editar:** Clic en el campo lo selecciona y abre el panel de propiedades para ajustar tipo, nombre, posición, tamaño, etc.

- **Acciones en lote:**
  - `"✓ Aceptar todos"` — Confirma todos los campos candidatos de una vez.
  - `"✕ Rechazar todos"` — Elimina todas las sugerencias.
  - `"Aceptar campos con confianza > 80%"` — Acepta solo los de alta confianza y deja los demás como candidatos.

- **Transición a modo Build:** Una vez que el usuario ha revisado las sugerencias, los campos confirmados se convierten en campos normales del modo Build y el usuario puede continuar editando, añadiendo o eliminando campos manualmente.

### 4.5 Manejo de errores de IA

**Qué:** La IA no siempre acierta. Se deben manejar elegantemente los fallos y las detecciones incorrectas.

**Cómo debe funcionar:**

- **Sin campos detectados:** `"La IA no ha encontrado campos en esta página. Puede que no sea un formulario. Puedes añadir campos manualmente."` con un botón `"Cambiar a modo manual"`.
- **Error de red / API key inválida:** `"No se pudo conectar con el servicio de IA. Comprueba tu conexión o configura la API key de Gemini en los ajustes. Puedes crear campos manualmente."`.
- **Detección parcial:** `"Se detectaron 8 campos en 2 páginas. 3 campos tienen baja confianza (< 70%) y necesitan tu revisión."`.
- **PDF sin texto (imagen escaneada):** `"Este PDF parece ser una imagen escaneada. La detección funciona pero la precisión puede ser menor. Para mejores resultados, usa un PDF generado digitalmente."`.
- **Fallback:** La herramienta siempre funciona sin IA. El modo Build manual está disponible incluso si la API de Gemini no está configurada o no funciona.

### 4.6 Indicador de progreso del análisis

**Qué:** Mientras la IA analiza las páginas, mostrar un indicador de progreso por página.

**Cómo debe funcionar:**

- Un modal centrado con:
  - Icono animado de un ojo escaneando (o una lupa que se mueve sobre un documento).
  - Texto: `"Analizando página 2 de 5…"`.
  - Barra de progreso por páginas.
  - Texto de estado bajo la barra: `"Detectados 6 campos hasta ahora"` (actualizado en tiempo real conforme cada página devuelve resultados).
  - Botón `"Cancelar"` para abortar el análisis.
- Las páginas se analizan en paralelo (máximo 3 simultáneas) si hay múltiples.
- Al completarse: transición suave del modal a la vista de revisión de sugerencias, con un resumen: `"✨ Detectados 12 campos en 3 páginas. Revisa las sugerencias."`.

---

## 5. Tipos de Campo Soportados

### 5.1 Campo de texto (Text Field)

**Apariencia en el formulario:** Un rectángulo con borde sutil y fondo ligeramente coloreado. Al hacer clic, aparece un cursor de texto parpadeante.

**Propiedades configurables:**
- **Nombre del campo** (identificador interno): `nombre_completo`, `email`, etc.
- **Etiqueta visible** (label): `"Nombre completo"`. Se muestra encima o a la izquierda del campo.
- **Placeholder**: Texto gris claro que se muestra cuando el campo está vacío: `"Escribe tu nombre…"`.
- **Valor por defecto**: Texto pre-rellenado que el usuario puede cambiar.
- **Ancho y alto**: Editable en px o arrastrado visualmente.
- **Obligatorio**: Toggle sí/no. Si es sí, muestra `*` en la etiqueta.
- **Solo lectura**: El usuario no puede editar el valor (útil para campos pre-rellenados por el sistema).
- **Longitud máxima**: Límite de caracteres (0 = sin límite).
- **Formato**: Libre, email, URL, DNI/NIF, código postal.
- **Estilo del texto**: Fuente (Helvetica, Times, Courier), tamaño (8-24pt), color, alineación (izq/centro/dcha).
- **Borde y fondo**: Color de borde, color de fondo, grosor de borde, radio de esquinas.

**Comportamiento en modo Fill:**
- Clic → foco con cursor parpadeante.
- Escribir → el texto aparece con la fuente y tamaño configurados.
- Si hay longitud máxima, el campo muestra un contador: `"23/50"`.
- Tab → siguiente campo en el orden.

### 5.2 Área de texto (Textarea)

**Igual que el campo de texto pero con:**
- Altura mínima de 60px (3 líneas).
- Scroll vertical si el contenido excede la altura del campo.
- Propiedad adicional: `Número de líneas visibles` (3-20).
- El campo se puede redimensionar verticalmente arrastrando el borde inferior (handle de resize).

### 5.3 Casilla de verificación (Checkbox)

**Apariencia:** Un cuadrado de 16×16px con borde de 2px. Al marcar, aparece un checkmark animado (trazo SVG de 200ms).

**Propiedades configurables:**
- **Nombre del campo** y **etiqueta** (texto a la derecha de la casilla).
- **Marcada por defecto**: sí/no.
- **Obligatorio**: Si es sí, debe estar marcada para poder guardar.
- **Estilo del check**: Color del check (`var(--signal)` por defecto), tamaño (12-24px).

**Comportamiento en modo Fill:**
- Clic → alterna entre marcada/desmarcada con animación de checkmark.
- Espacio → alterna (cuando tiene foco por teclado).

### 5.4 Selección única (Radio Buttons)

**Apariencia:** Grupo de círculos de 16×16px. El seleccionado tiene un punto sólido interior animado (escala 0 → 1 en 150ms).

**Propiedades configurables:**
- **Nombre del grupo** (todas las opciones comparten el mismo nombre).
- **Opciones**: Lista editable de valores. Cada opción tiene un `label` visible y un `value` interno.
  - Interfaz de edición de opciones: lista vertical con inputs de texto y botones `[+ Añadir opción]` y `[✕]` para eliminar. Las opciones se pueden reordenar con drag & drop.
- **Opción seleccionada por defecto**: Dropdown con las opciones.
- **Obligatorio**: sí/no.
- **Disposición**: `[Vertical] [Horizontal]`.

**Comportamiento en modo Fill:**
- Clic en una opción la selecciona y deselecciona la anterior del grupo.
- Las opciones no seleccionadas muestran un círculo vacío con borde gris; la seleccionada, un círculo con punto interior teal.

### 5.5 Lista desplegable (Dropdown / Combo Box)

**Apariencia:** Un rectángulo con una flecha `▾` a la derecha. Al hacer clic, se despliega una lista de opciones.

**Propiedades configurables:**
- **Nombre del campo** y **etiqueta**.
- **Placeholder**: `"Selecciona una opción…"`.
- **Opciones**: Lista editable (misma interfaz que radio buttons).
- **Permitir valor personalizado** (combo box editable): sí/no. Si es sí, el usuario puede escribir un valor que no está en la lista.
- **Opción por defecto**: Una de las opciones o ninguna.
- **Obligatorio**: sí/no.
- **Búsqueda en dropdown**: Si hay más de 8 opciones, mostrar un campo de búsqueda en la parte superior del dropdown para filtrar opciones.

**Comportamiento en modo Fill:**
- Clic → se despliega la lista con animación de `maxHeight: 0 → auto` + `opacity: 0 → 1` en 200ms.
- Hover en opciones → highlight con fondo `var(--signal)/10`.
- Clic en opción → se selecciona, el dropdown se cierra con animación inversa.
- Escape → cierra el dropdown sin seleccionar.

### 5.6 Campo de fecha (Date Picker)

**Apariencia:** Un campo de texto con un icono de calendario a la derecha.

**Propiedades configurables:**
- **Nombre del campo** y **etiqueta**.
- **Formato de fecha**: `DD/MM/AAAA` (por defecto en español), `MM/DD/YYYY`, `AAAA-MM-DD`.
- **Fecha mínima** y **fecha máxima**: Para restringir el rango.
- **Valor por defecto**: Fecha específica, `"hoy"`, o vacío.
- **Obligatorio**: sí/no.

**Comportamiento en modo Fill:**
- Clic en el campo o en el icono de calendario → abre un calendario flotante (datepicker).
- El datepicker muestra el mes actual con días clicables. Navegación con flechas `◀` `▶` entre meses. Clic en un día → se rellena la fecha en el formato configurado.
- El usuario también puede escribir la fecha directamente en el campo (con validación del formato).
- Si hay fechas mínima/máxima, los días fuera del rango se muestran deshabilitados (opacidad 0.3, sin cursor pointer).

### 5.7 Campo de firma (Signature)

**Apariencia:** Un rectángulo de 200×60px con borde punteado y texto centrado: `"Haz clic para firmar"` en gris claro, con un icono de bolígrafo.

**Propiedades configurables:**
- **Nombre del campo** y **etiqueta**.
- **Obligatorio**: sí/no.
- **Ancho y alto** del área de firma.

**Comportamiento en modo Fill:**
- Clic → abre el `SignatureModal` (ya existente en el proyecto) con tres modos:
  1. **Dibujar**: Canvas para dibujar la firma con el dedo/ratón.
  2. **Escribir**: Input de texto donde el usuario escribe su nombre y se renderiza con una fuente manuscrita (cursiva decorativa).
  3. **Subir imagen**: Subir una imagen de la firma en PNG/JPG.
- Al confirmar la firma, la imagen se incrusta en el campo con un efecto de "sello" (scale: 1.1 → 1 en 200ms, con leve opacidad que aumenta).
- El campo muestra la firma con un badge `"Firmado"` en verde.
- Botón `"Cambiar firma"` al hacer hover sobre el campo firmado.

### 5.8 Campo de archivo adjunto

**Apariencia:** Un rectángulo con borde punteado, icono de clip 📎 y texto: `"Arrastra un archivo o haz clic para adjuntar"`.

**Propiedades configurables:**
- **Nombre del campo** y **etiqueta**.
- **Tipos aceptados**: `[PDF] [Imágenes] [Documentos] [Todos]`.
- **Tamaño máximo**: En MB (1-50).
- **Obligatorio**: sí/no.

**Comportamiento en modo Fill:**
- Clic → abre diálogo de selección de archivo del SO.
- Drag & drop → acepta archivos arrastrados desde el escritorio.
- Una vez adjuntado, el campo muestra: `"📎 documento.pdf (2.3 MB) [✕ Quitar]"`.
- El archivo adjunto se incrusta en el PDF usando el sistema de adjuntos de `pdf-lib` (`pdfDoc.attach()`).

### 5.9 Campos especializados (Email, Teléfono, Número)

Son variantes del campo de texto con validación y formato pre-configurados:

| Campo | Validación | Teclado en móvil | Formato |
|:------|:-----------|:-----------------|:--------|
| **Email** | Regex de email, `@` obligatorio | `inputmode="email"` | texto libre |
| **Teléfono** | Solo dígitos, `+`, `-`, espacios | `inputmode="tel"` | Auto-formato: `+34 612 345 678` |
| **Número** | Solo dígitos y punto decimal | `inputmode="decimal"` | Configurable: entero, decimal, moneda |

### 5.10 Etiqueta (texto estático)

**Apariencia:** Texto estático sobre el PDF que no es un campo editable. Sirve para añadir instrucciones, títulos de sección o decoración.

**Propiedades configurables:**
- **Texto**: Contenido del label.
- **Fuente, tamaño, color, alineación**: Igual que un campo de texto pero sin input.
- **Negrita, cursiva, subrayado**: Toggles.
- **Fondo**: Color de fondo (o transparente).

---

## 6. Panel de Propiedades del Campo

### 6.1 Estructura

**Posición:** Panel lateral derecho de 260px de ancho, fondo `var(--paper-raised)`, borde izquierdo `var(--line)`.

**Contenido:** Se actualiza dinámicamente según el campo seleccionado. Cuando no hay ningún campo seleccionado, muestra un mensaje: `"Selecciona un campo para ver sus propiedades"`.

### 6.2 Secciones del panel

```
┌────────────────────────────┐
│ PROPIEDADES                │
│ ─────────────────────────  │
│                            │
│ General                    │
│ ┌──────────────────────┐   │
│ │ Nombre: [campo_1   ] │   │
│ │ Etiqueta: [Nombre  ] │   │
│ │ Tipo: [Texto      ▾] │   │
│ │ Placeholder: [     ] │   │
│ └──────────────────────┘   │
│                            │
│ Validación                 │
│ ┌──────────────────────┐   │
│ │ ☑ Obligatorio        │   │
│ │ ☐ Solo lectura       │   │
│ │ Máx. caracteres: [0] │   │
│ │ Formato: [Libre    ▾]│   │
│ └──────────────────────┘   │
│                            │
│ Apariencia                 │
│ ┌──────────────────────┐   │
│ │ Fuente: [Helvetica▾] │   │
│ │ Tamaño: [11pt     ] │   │
│ │ Color texto: [●]     │   │
│ │ Color fondo: [●]     │   │
│ │ Color borde: [●]     │   │
│ └──────────────────────┘   │
│                            │
│ Posición                   │
│ ┌──────────────────────┐   │
│ │ X: [120]  Y: [340]  │   │
│ │ W: [200]  H: [28]   │   │
│ │ Página: [1]          │   │
│ └──────────────────────┘   │
│                            │
│ Acciones                   │
│ [Duplicar] [Eliminar]      │
│ [Traer al frente]          │
│ [Enviar al fondo]          │
└────────────────────────────┘
```

### 6.3 Sección "General"

- **Nombre:** Input de texto. Se genera automáticamente como `campo_1`, `campo_2`, etc. El usuario puede cambiarlo. Si el nombre coincide con un campo conocido (name, email, phone, address), se auto-configura el tipo y la validación.
- **Etiqueta:** Texto visible que se muestra junto al campo en el formulario.
- **Tipo:** Dropdown que permite cambiar el tipo de campo (texto, checkbox, radio, etc.). Al cambiar el tipo, las propiedades se adaptan dinámicamente.
- **Placeholder:** Solo para campos de texto/dropdown.

### 6.4 Sección "Validación"

- **Obligatorio:** Toggle. Si es sí, el campo muestra un asterisco en el label y la validación impide guardar sin rellenar.
- **Solo lectura:** Toggle. El campo se muestra con fondo gris y no es editable.
- **Máx. caracteres:** Input numérico (0 = sin límite).
- **Formato:** Dropdown con opciones según el tipo de campo:
  - Texto: `[Libre] [Email] [URL] [DNI/NIF] [Código postal]`
  - Número: `[Entero] [Decimal] [Moneda (€)] [Porcentaje]`
  - Fecha: `[DD/MM/AAAA] [MM/DD/YYYY] [AAAA-MM-DD]`

### 6.5 Sección "Apariencia"

- **Fuente:** Dropdown con las fuentes disponibles en `pdf-lib`: Helvetica, Times-Roman, Courier.
- **Tamaño:** Slider de 8 a 24pt.
- **Color texto:** Color picker (con presets + selector libre).
- **Color fondo:** Color picker con opción "Transparente".
- **Color borde:** Color picker con opción "Sin borde".
- **Radio de esquinas:** Slider de 0 a 12px.

### 6.6 Sección "Posición"

- **X, Y:** Coordenadas en pt desde la esquina superior izquierda de la página. Editable manualmente para posicionamiento preciso.
- **W, H:** Ancho y alto en pt. Editable manualmente.
- **Página:** Indica en qué página está el campo (solo lectura).

---

## 7. Validación y Lógica Condicional

### 7.1 Validación en tiempo real

**Qué:** Los campos se validan conforme el usuario escribe, no solo al guardar.

**Cómo debe funcionar:**

- **Debounce:** La validación se ejecuta 300ms después de que el usuario deja de escribir.
- **Feedback visual:**
  - **Válido:** Borde cambia de neutro a teal (300ms). Checkmark sutil en la esquina.
  - **Inválido:** Borde cambia a rojo (300ms). Tooltip de error debajo del campo con el mensaje: `"Formato de email inválido"`, `"Este campo es obligatorio"`, `"Máximo 50 caracteres"`.
  - **Pendiente (escribiendo):** Sin cambio visual mientras el debounce está activo.

### 7.2 Reglas de validación disponibles

| Regla | Aplica a | Descripción |
|:------|:---------|:------------|
| Obligatorio | Todos | El campo no puede estar vacío |
| Longitud mínima | Texto, Textarea | Mínimo N caracteres |
| Longitud máxima | Texto, Textarea | Máximo N caracteres |
| Formato email | Email | Debe contener `@` y dominio válido |
| Formato URL | Texto | Debe empezar por `http://` o `https://` |
| Solo números | Número | No acepta letras ni símbolos |
| Rango numérico | Número | Valor entre min y max |
| Fecha mínima/máxima | Fecha | Dentro del rango de fechas |
| Patrón regex | Texto | Coincide con una expresión regular personalizada |

### 7.3 Lógica condicional (mostrar/ocultar campos)

**Qué:** Permitir que ciertos campos se muestren o se oculten según el valor de otro campo.

**Cómo debe funcionar:**

- **Configuración:** En el panel de propiedades de un campo, una sección colapsable `"Lógica condicional"`:
  ```
  Mostrar este campo SI:
  [campo_tipo ▾] [es igual a ▾] [Empresa ▾]
  [+ Añadir condición]
  ```
- **Operadores:** `es igual a`, `no es igual a`, `contiene`, `no contiene`, `está vacío`, `no está vacío`, `es mayor que`, `es menor que`.
- **Condiciones múltiples:** Se pueden añadir varias condiciones con lógica `Y` (todas deben cumplirse) o `O` (cualquiera es suficiente).
- **Comportamiento visual:**
  - El campo condicionado se oculta (`display: none` + animación de collapse de 200ms) cuando la condición no se cumple.
  - Al cumplirse, el campo aparece con una animación de expand + fade in de 200ms.
  - En modo Build, los campos condicionados se muestran con opacidad 0.5 y un badge `"Condicional"` para que el creador sepa que están ahí.

**Ejemplo de uso:** Un radio button con opciones `"Particular"` / `"Empresa"`. Si se selecciona `"Empresa"`, aparecen campos adicionales: `"Nombre de empresa"`, `"CIF"`, `"Cargo"`.

---

## 8. Exportación y Formatos de Salida

### 8.1 PDF interactivo (AcroForm)

**Formato principal de exportación.** El PDF resultante contiene campos AcroForm estándar que cualquier visor de PDF (Adobe Reader, Edge, Chrome, Preview de macOS) puede mostrar y rellenar.

**Cómo se genera:**

1. Cargar el PDF original con `pdf-lib`.
2. Acceder al formulario: `const form = pdfDoc.getForm()`.
3. Para cada campo definido por el usuario:
   - `form.createTextField(name).addToPage(page, { x, y, width, height })`.
   - `form.createCheckBox(name).addToPage(...)`.
   - `form.createRadioGroup(name).addOptionToPage(option, page, { ... })`.
   - `form.createDropdown(name).addToPage(...)`.
4. Aplicar propiedades visuales: fuente, tamaño, color, borde.
5. Guardar: `await pdfDoc.save()`.

### 8.2 PDF aplanado (flatten)

Opción de exportar el formulario rellenado con los valores "quemados" como texto estático. Útil cuando el receptor no debe poder editar las respuestas.

### 8.3 Exportar datos del formulario (JSON / CSV)

**Qué:** Exportar solo los datos rellenados (sin el PDF) como archivo JSON o CSV.

**Cómo debe funcionar:**

- Botón `"Exportar datos ▾"` con dropdown: `[JSON] [CSV]`.
- **JSON:**
  ```json
  {
    "nombre_completo": "Juan García López",
    "email": "juan@email.com",
    "acepto_terminos": true,
    "tipo_cliente": "Empresa",
    "fecha_nacimiento": "1990-03-15"
  }
  ```
- **CSV:** Primera fila con nombres de campos, segunda fila con valores.
- **Uso:** Si el usuario rellena múltiples copias del mismo formulario, puede exportar los datos de cada uno y consolidarlos en una hoja de cálculo.

### 8.4 Importar datos para pre-rellenar

**Qué:** Subir un archivo JSON con datos para pre-rellenar automáticamente un formulario.

**Cómo debe funcionar:**

- Botón `"Importar datos"` en modo Fill.
- Acepta un archivo `.json` con claves que coincidan con los nombres de los campos del formulario.
- Los campos que coincidan se rellenan automáticamente. Los que no coincidan se ignoran.
- Un resumen: `"Se rellenaron 8 de 12 campos. 4 no encontrados en el JSON."`.
- **Caso de uso:** Pre-rellenar el mismo formulario con datos de diferentes clientes/empleados importados desde un sistema externo.

---

## 9. Firma Electrónica Integrada

### 9.1 Firma simple (ya existente)

Reutilizar el `SignatureModal` del proyecto, que permite dibujar, escribir o subir una firma. La firma se incrusta como imagen en el campo de firma del formulario.

### 9.2 Solicitar firma a terceros

**Qué:** El creador del formulario puede generar un enlace único para que otra persona rellene y firme el formulario.

**Cómo debe funcionar:**

- Botón `"Enviar para firmar"` en el modo Build después de crear el formulario.
- Se genera un enlace único (hash del PDF codificado en base64 en la URL, o almacenado temporalmente en `localStorage` si es local-first).
- **Versión local (MVP):** El enlace se copia al portapapeles. La otra persona abre el enlace en su navegador, rellena el formulario, firma, y descarga el PDF rellenado. No hay servidor involucrado; el PDF está codificado en el propio enlace (para PDFs < 2MB usando URL encoding).
- **Versión futura (con servidor):** El PDF se sube temporalmente al servidor, la persona firma, y el creador recibe una notificación o puede descargar el PDF firmado.

### 9.3 Indicador de campos de firma

En modo Build, los campos de firma se destacan visualmente con un borde verde más grueso y un icono de bolígrafo permanente, para que sean fácilmente identificables como "aquí debe firmar alguien".

---

## 10. Experiencia de Usuario Detallada

### 10.1 Pantalla inicial (antes de cargar PDF)

**Cómo debe verse:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│          📋 Formularios PDF                     │
│                                                 │
│   ┌───────────────────────────────────────┐     │
│   │                                       │     │
│   │  ☁️ Arrastra tu PDF aquí              │     │
│   │     o haz clic para seleccionar       │     │
│   │                                       │     │
│   └───────────────────────────────────────┘     │
│                                                 │
│   ¿Qué quieres hacer?                          │
│                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ 📝       │  │ 🛠️       │  │ 🤖       │     │
│   │ Rellenar │  │ Crear    │  │ Detectar │     │
│   │ un form  │  │ campos   │  │ con IA   │     │
│   │ existente│  │ nuevos   │  │          │     │
│   └──────────┘  └──────────┘  └──────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

- Si el PDF tiene campos AcroForm, se detecta automáticamente y se sugiere el modo Fill.
- Si el PDF no tiene campos, se sugiere el modo Build o Detect.
- Las tres tarjetas de modo son clicables. El dropzone es universal (acepta cualquier PDF).

### 10.2 Detección automática de modo

**Qué:** Al cargar un PDF, el sistema detecta automáticamente si tiene campos AcroForm y sugiere el modo más apropiado.

**Cómo debe funcionar:**

1. Cargar el PDF con `pdf-lib`.
2. Verificar `pdfDoc.getForm().getFields().length`.
3. Si > 0: mostrar un banner: `"📋 Este PDF tiene ${n} campos rellenables. ¿Quieres rellenarlos?"` con botón `"Rellenar formulario"`.
4. Si === 0: mostrar: `"Este PDF no tiene campos interactivos. ¿Quieres crear un formulario?"` con botones `"Crear manualmente"` y `"Detectar con IA"`.

### 10.3 Atajos de teclado del modo Build

| Atajo | Acción |
|:------|:-------|
| `T` | Activar herramienta "Campo de texto" |
| `C` | Activar herramienta "Checkbox" |
| `R` | Activar herramienta "Radio button" |
| `D` | Activar herramienta "Dropdown" |
| `S` | Activar herramienta "Firma" |
| `V` o `Escape` | Volver a herramienta "Seleccionar" |
| `Ctrl+D` | Duplicar campo seleccionado |
| `Delete` | Eliminar campo seleccionado |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` | Rehacer |
| `Ctrl+G` | Toggle grid |
| `Ctrl+P` | Toggle modo preview |
| `Tab` | Seleccionar siguiente campo |
| `Shift+Tab` | Seleccionar campo anterior |
| `Flechas` | Mover campo seleccionado 1px |
| `Shift+Flechas` | Mover campo seleccionado 10px |
| `?` | Mostrar overlay de atajos |

### 10.4 Gestión del Tab Order

**Qué:** El orden en que el cursor salta de campo a campo al pulsar `Tab` debe ser configurable.

**Cómo debe funcionar:**

- **Auto-orden:** Por defecto, el orden se calcula automáticamente de arriba a abajo, izquierda a derecha, por página. Es la opción más intuitiva para la mayoría de formularios.
- **Orden manual:** Un botón `"Editar orden de tabulación"` en la barra superior que activa un modo especial:
  - Todos los campos muestran un número grande (24px, fondo azul, texto blanco) en su centro.
  - El usuario hace clic en los campos en el orden deseado. Cada clic asigna el siguiente número: 1, 2, 3…
  - Un botón `"Restablecer a auto"` para volver al orden automático.
  - Un botón `"Aplicar"` para confirmar el orden manual.
- **Visualización:** Al activar el modo de edición de orden, se muestran flechas curvas entre campos consecutivos formando un "camino" visual.

### 10.5 Resumen del formulario antes de exportar

**Qué:** Antes de guardar/exportar, mostrar un resumen del formulario creado.

**Cómo debe funcionar:**

- Un modal o panel que muestra:
  ```
  📊 Resumen del formulario
  ─────────────────────────
  Campos totales: 15
    • 8 campos de texto
    • 3 checkboxes
    • 2 radio groups
    • 1 dropdown
    • 1 firma
  
  Obligatorios: 10 de 15
  Con lógica condicional: 2
  
  Páginas con campos: 2 de 3
  
  Tab order: automático
  
  [Vista previa] [Exportar PDF]
  ```

---

## 11. Accesibilidad

### 11.1 Requisitos de accesibilidad

La herramienta de formularios debe cumplir los siguientes estándares:

- **Navegación por teclado:** Todos los campos deben ser navegables con `Tab`. Los botones del panel deben ser alcanzables con el teclado.
- **ARIA labels:** Todos los campos generados deben tener `aria-label` con el nombre del campo, `aria-required` si es obligatorio, y `aria-invalid` si tiene errores.
- **Contraste:** Los colores de los campos (texto, borde, fondo) deben cumplir una ratio de contraste mínimo de 4.5:1 (WCAG AA).
- **Mensajes de error:** Los errores de validación deben anunciarse mediante `aria-live="polite"` para lectores de pantalla.
- **Focus visible:** Todos los campos deben tener un indicador de foco visible (outline o ring) al navegar con teclado.

### 11.2 Formularios PDF accesibles

Al exportar el PDF con AcroForms, los campos deben incluir:
- **Tooltip** (campo `TU` en la especificación AcroForm): Descripción del campo para lectores de pantalla.
- **Orden de lectura** (Tab order): Definido correctamente para que los lectores de pantalla presenten los campos en orden lógico.

---

## 12. Casos de Uso Objetivo

### 12.1 Formularios administrativos

**Ejemplo:** Un formulario de solicitud de empleo.
- **Campos:** Nombre, apellidos, DNI, fecha de nacimiento, dirección, email, teléfono, estudios (dropdown), experiencia (textarea), firma.
- **Flujo:** La empresa crea el formulario → lo envía como PDF → el candidato lo rellena en DocLab → lo descarga y lo envía de vuelta.

### 12.2 Contratos y acuerdos

**Ejemplo:** Un contrato de alquiler.
- **Campos:** Datos del arrendador, datos del arrendatario, dirección del inmueble, precio mensual, duración, cláusulas (checkboxes: "Acepto cláusula X"), firma de ambas partes.
- **Flujo:** El propietario crea el formulario → lo envía al inquilino → ambos firman → se descarga el PDF final firmado.

### 12.3 Encuestas y cuestionarios

**Ejemplo:** Encuesta de satisfacción del cliente.
- **Campos:** Radio buttons para valoración (1-5 estrellas), checkboxes para áreas de mejora, textarea para comentarios libres.
- **Flujo:** El negocio crea la encuesta → la envía a clientes → recoge las respuestas como JSON/CSV.

### 12.4 Formularios médicos

**Ejemplo:** Historial clínico del paciente.
- **Campos:** Datos personales, alergias (checkboxes), medicación actual (textarea), antecedentes familiares (radio: sí/no + condicional), firma del paciente y del médico.
- **Lógica condicional:** Si "¿Tiene alergias?" = Sí → aparecen los campos de detalle de alergias.

### 12.5 Formularios educativos

**Ejemplo:** Matrícula universitaria.
- **Campos:** Datos del estudiante, carrera seleccionada (dropdown), asignaturas optativas (checkboxes), foto del DNI (adjunto), declaración jurada (checkbox), firma.
- **Detección IA:** El usuario sube el PDF de matrícula existente (plano) y la IA detecta los campos automáticamente.

### 12.6 Digitalización de formularios en papel

**Ejemplo:** Un formulario antiguo escaneado.
- **Flujo:** El usuario escanea el formulario → sube el escaneo como PDF → la IA detecta los campos → el usuario revisa y corrige → exporta como PDF interactivo.
- **Resultado:** Un formulario de papel se convierte en un formulario digital rellenable sin necesidad de recrearlo desde cero.

---

## Apéndice: Prioridades de Implementación

| Prioridad | Funcionalidad | Complejidad |
|:----------|:-------------|:------------|
| 🔴 P0 | Modo Fill: rellenar campos AcroForm existentes | Media |
| 🔴 P0 | Modo Build: crear campos de texto, checkbox, dropdown | Alta |
| 🟡 P1 | Panel de propiedades completo | Media |
| 🟡 P1 | Modo Preview | Baja |
| 🟡 P1 | Exportación como PDF interactivo con `pdf-lib` | Media |
| 🟢 P2 | Detección de campos con IA (Gemini Vision) | Media |
| 🟢 P2 | Validación en tiempo real | Baja |
| 🟢 P2 | Lógica condicional | Media |
| 🔵 P3 | Auto-rellenado con perfil | Baja |
| 🔵 P3 | Exportar datos JSON/CSV | Baja |
| 🔵 P3 | Importar datos para pre-rellenar | Baja |
| 🔵 P3 | Firma y envío a terceros | Alta |
| 🔵 P3 | Campo de archivo adjunto | Media |
