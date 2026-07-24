# DocLab — Informe de Auditoría UX y Especificación de Mejoras

> **Fecha:** 27 de junio de 2026
> **Objetivo:** Documentar en detalle cada mejora de experiencia de usuario propuesta para las 12 herramientas de DocLab. Cada entrada describe **qué** debe hacer la mejora, **cómo** debe comportarse visualmente y funcionalmente, y **por qué** mejora la experiencia del usuario.
> **Uso:** Este documento es la referencia técnica y de diseño para el desarrollo futuro de cada herramienta. No se requieren cambios de código inmediatos.

---

## Tabla de Contenidos

1. [Editar PDF (Visión Canva)](#1--editar-pdf--la-herramienta-canva)
2. [Unir PDF (Merge)](#2--unir-pdf-merge)
3. [Dividir PDF / Extraer Páginas (Split)](#3--dividir-pdf--extraer-páginas-split)
4. [Organizar / Rotar / Eliminar Páginas](#4--organizar--rotar--eliminar-páginas)
5. [Comprimir PDF](#5--comprimir-pdf)
6. [Marca de Agua (Watermark)](#6--marca-de-agua-watermark)
7. [Números de Página](#7--números-de-página)
8. [Imágenes a PDF (JPG/PNG → PDF)](#8--imágenes-a-pdf-jpgpng--pdf)
9. [PDF a Imágenes (JPG / PNG)](#9--pdf-a-imágenes-jpg--png)
10. [PDF a Texto](#10--pdf-a-texto)
11. [Office a PDF (Word, Excel, PowerPoint)](#11--office-a-pdf-word-excel-powerpoint)
12. [Editar Metadatos](#12--editar-metadatos)
13. [Mejoras Transversales (todas las herramientas)](#13--mejoras-transversales-todas-las-herramientas)

---

## 1. ✏️ Editar PDF — *"La herramienta Canva"*

### Estado actual

El editor ya es la herramienta más completa del catálogo. Cuenta con 8 sub-herramientas en un panel lateral (Mover, Texto, Lápiz, Marcar, Forma, Imagen, Firma, Goma), historial undo/redo de hasta 100 estados, zoom, controles de opacidad/rotación, duplicar, capas (traer al frente / enviar al fondo), y un marco de selección (`SelectionFrame`) con redimensionado y rotación libre. Usa `interact.js` para drag, `pdf-lib` para compilar las anotaciones en el PDF final, y `pdf.js` para renderizar las páginas de fondo.

---

### 1.1 Vista previa fantasma al colocar elementos

**Qué:** Cuando el usuario selecciona una herramienta que coloca un elemento (Texto, Firma, Imagen), debe aparecer un "fantasma" semitransparente que sigue al cursor por encima de la página antes de hacer clic.

**Cómo debe funcionar:**
- Al seleccionar la herramienta "Texto", el cursor cambia a `text` y aparece un rectángulo semitransparente de tamaño fijo (ej: 200×30px) con opacidad 0.3, con el texto placeholder "Escribe aquí…" en el color activo y la tipografía activa, que sigue al cursor en tiempo real.
- Al seleccionar "Firma", aparece la imagen de la última firma capturada (o un icono de firma genérico si no hay ninguna guardada), con opacidad 0.4, siguiendo al cursor.
- Al seleccionar "Imagen", se abre el diálogo de selección de archivo y, una vez elegida, la imagen aparece como fantasma semitransparente siguiendo al cursor hasta que se haga clic.
- El fantasma debe renderizarse como un `div` con `position: fixed` o `absolute` en la capa de captura, usando `pointer-events: none` para que no interfiera con la interacción.
- Al hacer clic, el fantasma se "solidifica" en su posición final con una microanimación de `opacity: 0.3 → 1` y `scale: 0.95 → 1` durante 150ms (ease-out).
- Si el cursor sale del área de la página, el fantasma se oculta temporalmente.

**Por qué:** El usuario sabe exactamente dónde va a caer el elemento antes de comprometerse. Elimina el patrón de "colocar → arrastrar a posición → ajustar" y lo reemplaza por "posicionar → confirmar", reduciendo pasos y aumentando la precisión.

---

### 1.2 Guías inteligentes de alineación (Snap Guides)

**Qué:** Líneas de guía azules/cian que aparecen automáticamente al arrastrar un elemento cuando este se acerca al centro de la página, al borde de otro elemento o a una línea de alineación compartida.

**Cómo debe funcionar:**
- **Activación:** Las guías se calculan en cada frame del evento `onMove` del drag. Se comparan las coordenadas (x, y, x+width, y+height, centroX, centroY) del elemento arrastrado con:
  1. El centro horizontal y vertical de la página.
  2. Los bordes (top, bottom, left, right) y centros de todos los demás elementos visibles en esa misma página.
- **Umbral de snap:** 8px en coordenadas de pantalla. Cuando la distancia entre cualquier par de coordenadas alineables es ≤ 8px, se activa el snap.
- **Comportamiento del snap:** La posición del elemento se corrige automáticamente a la coordenada de la guía (snap magnético). El movimiento libre se reanuda cuando el cursor se aleja más de 12px del punto de snap.
- **Renderizado visual:** Se dibuja una línea de 1px de grosor, color `var(--signal)` (el teal de la app), con estilo `dashed` (guiones de 4px). La línea se extiende de borde a borde de la página (horizontal o vertical según el caso). Se muestra también una etiqueta flotante con la distancia en píxeles entre los elementos si están próximos pero no alineados.
- **Guías del centro de página:** Aparecen cuando el centro del elemento está a ≤ 8px del centro de la página. Se muestran como una cruz de guías (horizontal + vertical) con un pequeño rombo en la intersección.
- **Desactivación:** Las guías desaparecen instantáneamente al soltar el drag (`onEnd`). Se puede desactivar temporalmente manteniendo pulsada la tecla `Alt` durante el arrastre (modo "libre").

**Por qué:** La alineación precisa sin esfuerzo es lo que separa una herramienta amateur de una profesional. Canva, Figma y PowerPoint usan este patrón. El usuario alinea elementos en 1 segundo en vez de 30.

---

### 1.3 Barra de herramientas flotante contextual

**Qué:** Al seleccionar un elemento (texto, imagen, forma, trazo), aparece una barra flotante compacta justo encima del elemento con las 4-6 acciones más frecuentes para ese tipo de elemento.

**Cómo debe funcionar:**
- **Posicionamiento:** La barra se posiciona 8px por encima del borde superior del bounding box del elemento seleccionado. Si no hay espacio (el elemento está pegado al borde superior de la página), la barra se posiciona 8px por debajo del borde inferior.
- **Contenido según tipo de elemento:**
  - **Texto:** `[Color] [Tamaño ▾] [B] [I] [U] | [Duplicar] [🗑️]`
  - **Imagen/Firma:** `[Opacidad ▾] [Duplicar] [Traer al frente] [🗑️]`
  - **Forma:** `[Color trazo] [Color relleno] [Grosor ▾] | [Duplicar] [🗑️]`
  - **Trazo/Dibujo:** `[Color] [Grosor ▾] | [Duplicar] [🗑️]`
  - **Highlight:** `[Color] [Opacidad ▾] | [🗑️]`
- **Estilo visual:** Fondo `var(--paper-raised)` con sombra `0 4px 12px rgba(0,0,0,0.15)`, bordes redondeados `8px`, padding `4px 8px`. Los botones son de 28×28px con hover suave. La barra tiene una flecha (triángulo CSS) apuntando hacia abajo para conectar visualmente con el elemento.
- **Animación de entrada:** `opacity: 0 → 1` + `translateY: 4px → 0px` en 120ms ease-out.
- **Animación de salida:** `opacity: 1 → 0` en 80ms ease-in al deseleccionar.
- **Interacción:** La barra no se mueve mientras se arrastra el elemento (se oculta durante el drag y reaparece al soltar). Si el elemento se mueve, la barra se reposiciona suavemente con una transición de 100ms.
- **Relación con el panel lateral:** La barra flotante NO reemplaza al panel lateral. El panel lateral muestra controles avanzados (rotación, opacidad precisa, interlineado, tipografía completa). La barra flotante es para las acciones rápidas del 80% de los casos.

**Por qué:** Reduce la distancia entre la acción y el control. El usuario no tiene que mover la mirada ni el cursor al panel lateral para las operaciones más comunes. Es el patrón estándar de Canva, Google Docs y Notion.

---

### 1.4 Doble clic para editar texto inline

**Qué:** Al hacer doble clic sobre un bloque de texto existente, se entra inmediatamente en modo de edición (el cursor de texto parpadea dentro del bloque) sin necesidad de seleccionar primero con la herramienta "Mover" y luego hacer clic en el textarea.

**Cómo debe funcionar:**
- **Evento:** `onDoubleClick` en el `div` del bloque de texto (`ed-text`).
- **Comportamiento actual:** Un solo clic selecciona el elemento (borde azul) y muestra los controles en el panel. Para editar el texto, el usuario tiene que hacer clic dentro del `<textarea>` que ya está visible.
- **Comportamiento deseado:**
  1. Doble clic → El textarea obtiene el foco (`focus()`) inmediatamente.
  2. El cursor de texto se posiciona en la posición más cercana al punto del doble clic dentro del texto existente.
  3. Se selecciona la palabra bajo el cursor (comportamiento estándar del navegador al hacer doble clic en texto).
  4. El panel lateral cambia automáticamente a los controles de texto.
  5. Si la herramienta activa es otra distinta a "Mover", se cambia temporalmente a "Mover" para permitir la edición.
- **Salida del modo edición:** Al hacer clic fuera del textarea, o al presionar `Escape`, se deselecciona el texto y se vuelve al estado anterior.

**Por qué:** Es el patrón universal de edición de texto en cualquier herramienta gráfica (PowerPoint, Canva, Figma, Keynote). El flujo actual requiere un paso extra que es confuso para nuevos usuarios.

---

### 1.5 Minimap / Panel de navegación de páginas

**Qué:** Un panel lateral estrecho (o un desplegable) que muestra miniaturas pequeñas de todas las páginas del documento, permitiendo hacer clic en cualquiera para hacer scroll instantáneo a esa página.

**Cómo debe funcionar:**
- **Posición:** Un strip vertical de 60px de ancho en el borde izquierdo del editor (colapsable con un botón `«`). Aparece solo cuando el documento tiene más de 2 páginas.
- **Contenido:** Miniaturas de cada página a una resolución baja (60px de ancho), con un número de página debajo de cada miniatura en `font-size: 9px`.
- **Indicador de página activa:** La miniatura de la página actualmente visible en el viewport tiene un borde de 2px en `var(--signal)` y un fondo ligeramente más brillante. Se actualiza en tiempo real conforme el usuario hace scroll (usando `IntersectionObserver` en cada contenedor de página).
- **Navegación:** Al hacer clic en una miniatura, la vista principal hace `scrollIntoView({ behavior: 'smooth' })` hasta esa página.
- **Indicador de anotaciones:** Las páginas que tienen anotaciones muestran un pequeño punto azul (`4px`, `border-radius: 50%`) en la esquina superior derecha de la miniatura.
- **Responsive:** En pantallas < 1024px, el minimap se oculta y se reemplaza por un selector desplegable compacto "Página 3 / 15 ▾" que abre un dropdown de selección rápida.

**Por qué:** En documentos de 10+ páginas, el usuario pierde la orientación al hacer scroll. El minimap le da una visión global permanente y navegación instantánea, igual que en Figma o Adobe Acrobat.

---

### 1.6 Multi-selección de elementos

**Qué:** Capacidad de seleccionar múltiples anotaciones simultáneamente para moverlas, alinearlas, duplicarlas o eliminarlas como grupo.

**Cómo debe funcionar:**
- **Selección por Shift+clic:** Manteniendo `Shift` pulsado, cada clic en un elemento lo añade (o lo quita si ya estaba) al conjunto de selección. Los elementos seleccionados muestran todos el borde `ring-2 ring-signal`.
- **Selección por lazo (marquee):** En modo "Mover", si el usuario hace clic en un área vacía de la página y arrastra, aparece un rectángulo punteado azul. Todos los elementos cuyo bounding box quede total o parcialmente dentro del rectángulo se seleccionan al soltar.
  - El rectángulo se renderiza como un `<div>` con `border: 1.5px dashed var(--signal)`, `background: rgba(15, 181, 166, 0.06)`, `pointer-events: none`.
  - Animación de dibujado en tiempo real mientras se arrastra.
- **Bounding box del grupo:** Se calcula un bounding box que engloba todos los elementos seleccionados. Este bounding box muestra:
  - Un contorno punteado gris alrededor de todo el grupo.
  - Handles de redimensionado en las esquinas (afecta proporcionalmente a todos los elementos del grupo).
- **Operaciones en grupo:**
  - **Mover:** Arrastrar cualquier elemento del grupo mueve todos a la vez, manteniendo sus posiciones relativas.
  - **Duplicar:** `Ctrl+D` duplica todos los elementos seleccionados, desplazados 12px hacia abajo y derecha.
  - **Eliminar:** `Delete` o `Backspace` elimina todos los seleccionados (con confirmación si son más de 5).
  - **Alinear:** Aparecen botones adicionales en el panel: "Alinear izquierda", "Centrar horizontal", "Alinear derecha", "Distribuir vertical", "Distribuir horizontal". Estas operaciones calculan la posición relativa entre los elementos y los redistribuyen equitativamente.
- **Deseleccionar:** Clic en un área vacía sin Shift deselecciona todo.

**Por qué:** Sin multi-selección, reorganizar un documento con muchas anotaciones es tedioso (hay que mover una por una). Es una funcionalidad estándar en toda herramienta de edición gráfica.

---

### 1.7 Historial visual de estados

**Qué:** En lugar de solo undo/redo "ciego" (el usuario no sabe a qué estado va a volver), un panel desplegable que muestra una línea temporal con miniaturas de cada snapshot del documento.

**Cómo debe funcionar:**
- **Acceso:** Un botón "Historial" (icono de reloj) al lado de los botones de undo/redo en el panel lateral. Al hacer clic, se despliega un panel vertical de 200px de ancho que se superpone al panel de herramientas.
- **Contenido:** Una lista vertical de snapshots, cada uno con:
  - Miniatura renderizada de la página activa en ese estado (80px de ancho).
  - Timestamp relativo ("Hace 2 min", "Hace 30s").
  - Descripción automática de la acción ("Texto añadido", "Forma movida", "Imagen insertada").
  - El estado actual está resaltado con un borde azul y un badge "Actual".
- **Navegación:** Al hacer clic en cualquier snapshot, el estado del editor se restaura a ese punto. Los estados posteriores se mueven a la pila de "redo" y se muestran con opacidad reducida.
- **Límite:** Se muestran los últimos 20 snapshots visibles (los 100 siguen disponibles vía undo/redo, pero solo se renderizan miniaturas de los 20 más recientes por rendimiento).
- **Optimización:** Las miniaturas no se renderizan en tiempo real. Se generan asincrónicamente (200ms delay) al crear cada snapshot. Si no se ha generado aún, se muestra un placeholder gris con un spinner.

**Por qué:** El undo/redo sin contexto visual genera ansiedad ("¿esto es lo que quería?"). El historial visual da confianza total al usuario para experimentar libremente sabiendo que puede volver a cualquier estado.

---

### 1.8 Emojis, stickers y sellos predefinidos

**Qué:** Una pestaña o sección adicional en el panel lateral que muestra una galería de elementos gráficos listos para usar: sellos corporativos, iconos, checkmarks, emojis, y badges como "APROBADO", "RECHAZADO", "URGENTE".

**Cómo debe funcionar:**
- **Acceso:** Un nuevo botón en la cuadrícula de herramientas con icono de carita sonriente / sello, con label "Sellos".
- **Panel:** Al activar, el panel lateral muestra una cuadrícula de elementos agrupados por categoría:
  - **Sellos de estado:** APROBADO (verde), RECHAZADO (rojo), BORRADOR (naranja), REVISADO (azul), URGENTE (rojo), CONFIDENCIAL (gris oscuro). Cada uno renderizado como un rectángulo con bordes redondeados, tipografía bold, con efecto de sello (leve rotación de 5°-15° aleatoria al insertar, borde doble).
  - **Checkmarks y flechas:** ✓, ✕, →, ★, ●, ▲ en distintos colores.
  - **Iconos de firma:** "Firmado por:", "Fecha:", "Visto bueno" con espacios en blanco para rellenar.
- **Inserción:** Al hacer clic en un sello, se inserta como una anotación de imagen SVG/PNG (rasterizada a 300dpi) en el centro de la página activa, con el modo "Mover" activado para reposicionarla inmediatamente.
- **Personalización post-inserción:** Una vez insertado, el usuario puede:
  - Redimensionarlo (handles de esquina).
  - Rotarlo (handle de rotación).
  - Cambiar la opacidad (panel lateral).
  - Los sellos de texto permitirán editar el texto interno (doble clic → editable).

**Por qué:** El 60% de los usuarios que editan PDFs necesitan marcar documentos con estados de aprobación. Actualmente deben escribir "APROBADO" manualmente, elegir fuente, color, tamaño, rotar, etc. Un sello predefinido resuelve esto en 1 clic.

---

### 1.9 Modo pantalla completa / foco

**Qué:** Un botón que oculta el panel lateral, el header de la app y cualquier otra interfaz, dejando solo el lienzo con las páginas del documento a pantalla completa del viewport.

**Cómo debe funcionar:**
- **Activación:** Botón con icono de `Maximize2` en la zona del zoom. Atajo de teclado: `F11` o `Ctrl+Shift+F`.
- **Animación de entrada:** El panel lateral se desliza hacia la derecha (`translateX: 0 → 100%`, 200ms ease-out). El header se desliza hacia arriba (`translateY: 0 → -100%`, 200ms). El lienzo se expande suavemente a todo el ancho.
- **Barra flotante de controles en modo foco:** Una barra translúcida (fondo `rgba(20,22,27,0.7)` con `backdrop-filter: blur(8px)`) aparece fija en la parte inferior de la pantalla, con:
  - Los 8 botones de herramientas en horizontal (compactos, solo iconos).
  - Controles de zoom.
  - Botón "Salir de pantalla completa" (icono de `Minimize2`).
  - La barra se oculta automáticamente después de 3 segundos de inactividad del cursor y reaparece al mover el cursor hacia la parte inferior de la pantalla (zona de 60px desde el borde).
- **Salida:** `Escape` o clic en el botón de salir. Animación inversa (panel y header regresan).

**Por qué:** Para ediciones detalladas en documentos grandes, el espacio en pantalla es valioso. El modo foco maximiza el lienzo y reduce distracciones, igual que el modo presentación de Figma o el modo foco de cualquier editor de texto.

---

### 1.10 Animación de guardado con preview

**Qué:** Al pulsar "Guardar PDF", en vez de mostrar solo un spinner, se muestra una animación que transmita visualmente que el documento se está compilando de forma profesional.

**Cómo debe funcionar:**
- **Fase 1 - "Compilando" (0-70% del proceso):**
  - Un modal centrado con fondo semitransparente (`backdrop: rgba(0,0,0,0.4)`).
  - En el centro, una miniatura del documento que se "ensambla" visualmente: las anotaciones (textos, formas, imágenes) se animan flotando desde posiciones aleatorias y se "incrustan" en la página con un efecto de escala + opacidad.
  - Texto debajo: "Incrustando anotaciones…" con un contador de progreso "3 de 12 elementos".
- **Fase 2 - "Generando PDF" (70-100%):**
  - La miniatura del documento se "sella" con un efecto de brillo que recorre la superficie de arriba a abajo (shimmer).
  - Texto: "Generando PDF final…"
- **Fase 3 - "Completado":**
  - La miniatura se transforma en un icono de documento PDF con un checkmark verde animado (dibujo de trazo SVG).
  - Confetti sutil (10-15 partículas en los colores de la app) durante 800ms.
  - Botones de "Descargar" y "Seguir editando" aparecen con un `fadeIn` de 200ms.
- **Si hay error:** El modal muestra un icono de advertencia con shake animation y mensaje de error en rojo.

**Por qué:** La fase de guardado es donde el usuario espera sin hacer nada. Una animación elaborada transforma esa espera en una experiencia satisfactoria y transmite que "algo importante está pasando", reforzando la percepción de calidad de la herramienta.

---

### 1.11 Funcionalidades adicionales para nivel Canva

#### Capas de texto enriquecido
Permitir dentro de un mismo bloque de texto aplicar negritas, cursivas, colores distintos y tamaños diferentes a fragmentos específicos (no solo al bloque entero). Requiere migrar de `<textarea>` a un editor `contenteditable` con sistema de rangos de selección.

#### Plantillas predefinidas
Una galería accesible desde la pantalla inicial del editor (antes de cargar un PDF) con plantillas como: membrete de empresa, factura, certificado, CV, carta formal. Cada plantilla es un PDF base con zonas de texto predefinidas que el usuario personaliza.

#### Grid y reglas
Reglas horizontales y verticales tipo Photoshop en los bordes del lienzo, con marcas cada 10mm/0.5in. Un grid de puntos suaves (opacidad 0.1) cada 10px que se puede activar/desactivar con `Ctrl+G`. Los elementos hacen snap al grid cuando está activo.

#### Bloquear elementos
Un botón de candado en la barra flotante o panel lateral que congela la posición, tamaño y rotación de un elemento. El elemento se muestra con un icono de candado superpuesto y no responde a eventos de drag/resize. Útil para evitar mover el logo de fondo al editar el texto encima.

#### Agrupación de elementos
Seleccionar múltiples elementos → botón "Agrupar" (`Ctrl+G`) → se mueven, redimensionan y rotan como una unidad. "Desagrupar" (`Ctrl+Shift+G`) los separa. Los grupos pueden tener nombre editable visible en el panel de capas.

---

## 2. 📎 Unir PDF (Merge)

### Estado actual

Funcional: lista vertical de archivos con flechas ↑↓ para reordenar, botón ✕ para quitar, sin miniaturas ni drag & drop. Muestra nombre de archivo y peso. La unión se ejecuta con `pdf-lib` en el cliente.

---

### 2.1 Drag & drop para reordenar la lista

**Qué:** Reemplazar las flechas ↑↓ con un sistema de arrastrar y soltar para reordenar los PDFs en la lista.

**Cómo debe funcionar:**
- Integrar `SortableJS` (ya disponible en el proyecto como dependencia) en el `<ul>` de la lista de archivos.
- Cada item de la lista muestra un handle de agarre (icono `GripVertical`) en el extremo izquierdo. El arrastre solo se activa desde ese handle (para no interferir con el clic en el nombre del archivo).
- Al arrastrar, el item se levanta visualmente con una sombra aumentada (`box-shadow: 0 8px 24px rgba(0,0,0,0.15)`) y una leve rotación de 1° para dar sensación de "despegue físico". El espacio original queda como un hueco vacío con borde punteado.
- El resto de items se desplazan suavemente (`animation: 160ms`) para mostrar dónde se insertará el item arrastrado.
- Las flechas ↑↓ se mantienen como alternativa accesible (para usuarios de teclado o tablet donde el drag es menos cómodo), pero se reducen visualmente a iconos más pequeños y se muestran solo en hover del item.

**Por qué:** El drag & drop es la interacción más intuitiva y natural para reordenar listas. Las flechas ↑↓ requieren múltiples clics para mover un archivo del final al principio. Con drag, es un solo gesto.

---

### 2.2 Miniatura de la primera página de cada PDF

**Qué:** Al añadir un PDF a la lista, renderizar la primera página como miniatura junto al nombre del archivo.

**Cómo debe funcionar:**
- Al leer los bytes del archivo (`readFileBytes`), inmediatamente después de la validación, crear un `pdfLoadingTask` con `pdf.js` y renderizar la página 1 a un canvas de 60px de ancho.
- La miniatura se muestra a la izquierda del nombre del archivo, en un contenedor de 48×60px con `border-radius: 4px`, `border: 1px solid var(--line)`, y fondo blanco.
- Mientras se renderiza, mostrar un placeholder gris con un skeleton animation (shimmer de izquierda a derecha).
- La miniatura se almacena como `dataUrl` en el objeto `Item` junto a los bytes y el nombre.
- El renderizado se hace en paralelo para todos los archivos (sin bloquear la interfaz).

**Por qué:** En una lista de 10 PDFs con nombres como "scan_001.pdf", "scan_002.pdf", el usuario no puede distinguirlos. Una miniatura le permite identificar visualmente cada documento sin abrirlo.

---

### 2.3 Indicador de número de páginas por archivo

**Qué:** Mostrar el número de páginas de cada PDF junto al peso del archivo.

**Cómo debe funcionar:**
- Extraer `pdf.numPages` del mismo `pdfLoadingTask` usado para la miniatura (reutilizar la promesa, no crear otra).
- Mostrar como texto con estilo `font-mono text-xs text-graphite`: `"12 págs · 2.4 MB"`.
- También mostrar un total acumulado debajo de la lista: `"Total: 47 páginas · 15.2 MB"`.

**Por qué:** El usuario necesita saber cuánto de largo será el documento final antes de unir. Sin esta información, tiene que adivinar.

---

### 2.4 Barra de progreso por archivo durante la carga

**Qué:** Mientras se leen los bytes de un archivo grande (drag & drop de un PDF de 50MB), mostrar una barra de progreso individual para ese archivo.

**Cómo debe funcionar:**
- Usar `FileReader` con evento `onprogress` que reporta `loaded` y `total`.
- Mostrar una barra de progreso delgada (3px de alto) debajo del nombre del archivo, con color `var(--signal)`, animación suave de ancho `0% → 100%`.
- Al completarse, la barra hace un flash de brillo y desaparece con un fade de 300ms.
- Si el archivo es < 1MB, no mostrar barra (se lee instantáneamente).

**Por qué:** En archivos pesados, el usuario puede pensar que la app se ha colgado si no ve ningún feedback durante la carga.

---

### 2.5 Preview del resultado final antes de descargar

**Qué:** Después de pulsar "Unir" y antes de la descarga, mostrar un carrusel de miniaturas de todas las páginas del PDF resultante para que el usuario confirme el orden y contenido.

**Cómo debe funcionar:**
- Usar el componente `ResultPreview` existente, pero ampliarlo para que, además del botón de descarga, muestre un grid de miniaturas de las primeras 20 páginas (con texto "y X más…" si hay más de 20).
- Las miniaturas se renderizan con `pdf.js` desde los bytes del resultado.
- El usuario puede hacer clic en cualquier miniatura para verla ampliada en un modal.
- Si el orden no es correcto, un botón "← Volver a editar" le permite regresar a la lista y reordenar.

**Por qué:** El error más común al unir PDFs es el orden incorrecto. Un preview elimina la necesidad de descargar, abrir en otro visor, descubrir el error, y volver a empezar.

---

### 2.6 Selección múltiple + borrar en lote

**Qué:** Checkboxes que permiten seleccionar varios archivos de la lista y eliminarlos con un solo botón.

**Cómo debe funcionar:**
- Cada item de la lista tiene un checkbox redondo (no cuadrado, por coherencia visual) a la izquierda del handle de arrastre. Por defecto, los checkboxes están ocultos y solo aparecen al hacer hover sobre la lista.
- Al marcar al menos un checkbox, aparece una barra de acciones flotante en la parte inferior de la lista: `"3 seleccionados | [Quitar seleccionados] [Seleccionar todos]"`.
- El botón "Quitar seleccionados" elimina los items con una animación de colapso (cada item se reduce en altura y se desvanece, 200ms, escalonados 50ms entre sí).
- `Ctrl+A` selecciona todos. `Escape` deselecciona todos.

**Por qué:** Si el usuario ha añadido 15 archivos y necesita quitar 8 de ellos, sin selección en lote tiene que hacer 8 clics individuales en botones ✕ muy pequeños.

---

## 3. ✂️ Dividir PDF / Extraer Páginas (Split)

### Estado actual

Grid de miniaturas con selección individual por clic y campo de texto para rangos manuales ("1-3, 5, 8"). Diferencia entre "Dividir" y "Extraer" vía preset (misma interfaz). Botones "Todas" / "Ninguna". Genera un único PDF de salida.

---

### 3.1 Selección por arrastre (marquee en el grid)

**Qué:** Hacer clic en una miniatura y arrastrar por encima de otras para seleccionar un bloque consecutivo sin soltar el clic.

**Cómo debe funcionar:**
- `onPointerDown` en el grid inicia el tracking. `onPointerMove` calcula qué miniaturas están bajo el cursor (usando `elementsFromPoint` o calculando por posición en el grid).
- Las miniaturas que entran en el rango se seleccionan (toggle) en tiempo real con un efecto de highlight instantáneo (borde azul aparece con transición de 100ms).
- Al soltar (`onPointerUp`), la selección se confirma y el campo de texto de rangos se actualiza automáticamente para reflejar la selección visual.
- Funciona tanto para seleccionar como para deseleccionar (si se inicia el arrastre desde una página ya seleccionada, el arrastre deselecciona).

**Por qué:** Para seleccionar las páginas 5 a 25 de un documento de 50 páginas, el usuario tiene que: o escribir "5-25" (requiere conocer la interfaz) o hacer 21 clics individuales. Con arrastre, es un solo gesto.

---

### 3.2 Línea visual de "corte"

**Qué:** Una línea roja punteada con un icono de tijera que aparece entre grupos de páginas seleccionadas y no seleccionadas, indicando visualmente dónde se va a "cortar" el documento.

**Cómo debe funcionar:**
- El sistema recorre las miniaturas y detecta las transiciones entre "seleccionada" y "no seleccionada". En cada transición, inserta un separador visual en el grid.
- El separador es un `div` de ancho completo (ocupa toda la fila del grid) con una línea horizontal de `2px dashed #d92d20` (rojo del sistema). En el centro de la línea, un icono de tijera (✂️, 16×16px) con un leve rebote de animación al aparecer.
- Los separadores se insertan/eliminan dinámicamente con animación de expand/collapse (de `height: 0` a `height: 24px` en 200ms).

**Por qué:** La acción de "dividir" es abstracta. El usuario selecciona páginas pero no "ve" el resultado. La línea de corte transforma una abstracción en una representación visual directa.

---

### 3.3 Preview lateral del resultado

**Qué:** Un panel lateral (o inferior en móvil) que muestra en tiempo real una previsualización de cómo quedará el PDF resultante con las páginas actualmente seleccionadas.

**Cómo debe funcionar:**
- Un contenedor de 240px de ancho fijo a la derecha del grid de selección (en pantallas ≥ 1280px). En pantallas más pequeñas, un botón "Vista previa" que abre un modal.
- El panel muestra las miniaturas de las páginas seleccionadas en orden, con su número de página original y un número secuencial nuevo: `"Página 5 → 1"`, `"Página 6 → 2"`, `"Página 12 → 3"`.
- Se actualiza en tiempo real (debounce de 300ms) al añadir/quitar páginas de la selección.
- Indicador de peso estimado: `"~2.1 MB estimados"` (calculado proporcionalmente por nº de páginas).

**Por qué:** El usuario necesita confirmar visualmente que su selección es correcta antes de procesar. Sin preview, el flujo es: seleccionar → procesar → descargar → abrir → verificar → si está mal, volver a empezar.

---

### 3.4 Modo "dividir cada N páginas"

**Qué:** Un modo alternativo que, en vez de seleccionar páginas manualmente, permite especificar un número N y generar automáticamente múltiples PDFs de N páginas cada uno.

**Cómo debe funcionar:**
- Un toggle o pestaña en la parte superior: `[Manual] [Cada N páginas]`.
- En el modo "Cada N páginas", aparece un slider o input numérico: "Dividir cada [5▾] páginas".
- El grid de miniaturas muestra los grupos generados automáticamente con separadores coloreados alternos (grupo 1 borde azul, grupo 2 borde verde, grupo 3 borde naranja…).
- Un resumen debajo: `"Se generarán 4 archivos PDF: 5, 5, 5, 3 páginas"`.
- Al ejecutar, se descargan todos los PDFs en un archivo ZIP (`doclab-divididos.zip`), con nombres `documento-parte-1.pdf`, `documento-parte-2.pdf`, etc.

**Por qué:** Caso de uso muy frecuente: dividir un informe de 50 páginas en capítulos de 10 páginas, o separar un escaneo con múltiples documentos de 2 páginas cada uno.

---

### 3.5 Shift+clic para seleccionar rangos

**Qué:** Mantener `Shift` pulsado y hacer clic en una miniatura selecciona automáticamente todas las páginas entre la última seleccionada y la actual.

**Cómo debe funcionar:**
- Se almacena el índice de la última página en la que se hizo clic (sin Shift) como `lastClickedIndex`.
- Al hacer `Shift+clic` en otra página, se calculan todos los índices entre `lastClickedIndex` y el índice actual, y se añaden al `Set` de seleccionadas.
- Si la dirección es descendente (clic en página 10, luego Shift+clic en página 5), se seleccionan de la 5 a la 10.
- El campo de texto de rangos se actualiza automáticamente.

**Por qué:** Es el patrón estándar de selección en explorador de archivos de Windows, macOS, y la web. Los usuarios lo esperan instintivamente.

---

### 3.6 Indicador de peso estimado del resultado

**Qué:** Mostrar una estimación del peso del PDF resultante basada en el número de páginas seleccionadas respecto al total.

**Cómo debe funcionar:**
- Cálculo: `(páginas seleccionadas / total de páginas) × peso del archivo original`.
- Mostrado junto al botón de acción: `"Extraer 5 páginas (~1.2 MB)"`.
- Si la estimación es > 10MB, mostrar un aviso: `"El archivo resultante puede ser grande. Considera comprimirlo después."` (con link a la herramienta de comprimir).

**Por qué:** El usuario necesita saber el impacto de su selección antes de procesar, especialmente si va a enviar el PDF por email (límite de adjuntos).

---

### 3.7 Generación de múltiples PDFs con descarga ZIP

**Qué:** Permitir generar múltiples PDFs de salida (no solo uno) cuando la selección tiene gaps (páginas no consecutivas), y descargarlos como ZIP.

**Cómo debe funcionar:**
- Si la selección tiene grupos no consecutivos (ej: páginas 1-3, 7-9, 12), ofrecer la opción: `"[Un solo PDF con todas] [Un PDF por grupo (3 archivos)]"`.
- En modo "un PDF por grupo", se generan archivos individuales y se empaquetan con la librería `client-zip` (ya instalada) en un ZIP descargable.
- Nombres de los archivos: `documento-pag-1-3.pdf`, `documento-pag-7-9.pdf`, `documento-pag-12.pdf`.

**Por qué:** La funcionalidad completa de "Dividir" (vs. "Extraer") implica generar múltiples outputs. Actualmente solo genera un PDF, lo que limita el caso de uso.

---

## 4. 📄 Organizar / Rotar / Eliminar Páginas

### Estado actual

Grid de miniaturas con SortableJS para drag & drop (solo en modos "organize" y "rotate"), botones de rotar 90° y eliminar por página individual. Tres modos vía preset: organizar, rotar, eliminar.

---

### 4.1 Animación de rotación suave

**Qué:** Al rotar una página, la miniatura rota visualmente con una transición suave en vez de un salto instantáneo.

**Cómo debe funcionar:**
- CSS: `transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)` en el `<img>` de la miniatura. El `cubic-bezier` con overshoot genera un leve "rebote" al final de la rotación que se siente elástico y satisfactorio.
- El estado `rotation` se actualiza inmediatamente (para que el estado interno sea correcto), y la transición CSS se encarga del efecto visual.
- Un pequeño badge animado aparece brevemente ("90°" en un pill verde) en la esquina de la miniatura durante 800ms y luego se desvanece.

**Por qué:** Los cambios instantáneos se sienten bruscos y no dan feedback de que algo ha ocurrido. Una animación de 300ms es lo suficientemente rápida para no ralentizar el flujo pero lo suficientemente visible para confirmar la acción.

---

### 4.2 Confirmación visual de eliminación

**Qué:** Al eliminar una página, en vez de desaparecer instantáneamente, la miniatura se desvanece con una animación y aparece un toast con opción de deshacer.

**Cómo debe funcionar:**
- **Animación de eliminación:** La miniatura se reduce (`scale: 1 → 0.8`), se desvanece (`opacity: 1 → 0`) y colapsa su espacio en el grid (`max-height → 0`, `margin → 0`, `padding → 0`) en 250ms total.
- **Toast de deshacer:** En la parte inferior de la pantalla, aparece un toast: `"Página 5 eliminada [Deshacer]"`. El toast permanece 5 segundos y luego se desvanece. Si se hace clic en "Deshacer", la página reaparece en su posición original con la animación inversa.
- **Múltiples eliminaciones:** Si se eliminan varias páginas rápidamente, el toast se actualiza: `"3 páginas eliminadas [Deshacer todo]"`.
- Internamente, la página no se elimina del array hasta que el toast expire. Se marca con un flag `deleted: true` y se filtra visualmente.

**Por qué:** Eliminar una página es una acción destructiva. Un desvanecimiento + undo de 5 segundos da una red de seguridad intuitiva sin interrumpir el flujo con un diálogo de confirmación molesto.

---

### 4.3 Selección múltiple para operaciones en lote

**Qué:** Permitir seleccionar múltiples páginas (con checkboxes o Shift+clic) para rotarlas o eliminarlas todas a la vez.

**Cómo debe funcionar:**
- Un checkbox circular sutil aparece en la esquina superior izquierda de cada miniatura al hacer hover (o permanente en modo "eliminar").
- Al seleccionar ≥ 2 páginas, aparece una barra de acciones flotante pegada a la parte inferior del grid:
  - `"5 páginas seleccionadas | [Rotar todas +90°] [Eliminar seleccionadas] [Seleccionar todas] [Deseleccionar]"`
- Shift+clic selecciona un rango entre la última página clickeada y la actual.
- `Ctrl/Cmd+A` selecciona todas.

**Por qué:** Rotar 20 páginas una por una (20 clics en botones pequeños) es tedioso. Seleccionar todas y rotar con 1 clic es lo natural.

---

### 4.4 Zoom de página individual

**Qué:** Al hacer clic en una miniatura (no en los botones de acción), se abre un modal que muestra la página a tamaño completo.

**Cómo debe funcionar:**
- Clic en la miniatura (fuera de los botones de rotar/eliminar) abre un modal centrado con la página renderizada a la resolución máxima del viewport (con `pdf.js` a resolución ×2 para nitidez retina).
- El modal tiene fondo oscuro semi-transparente, la imagen centrada, y controles: `[← Anterior] [Siguiente →] [Cerrar ✕]`.
- Navegación con flechas de teclado `←` `→` y `Escape` para cerrar.
- La animación de apertura es un zoom-in desde la posición de la miniatura (la miniatura se expande hasta llenar el modal, tipo lightbox).

**Por qué:** Las miniaturas son de 220px de ancho, insuficientes para leer el contenido. El usuario necesita ver la página a tamaño completo para decidir si es la que quiere rotar/eliminar, especialmente en PDFs escaneados donde todas las páginas se parecen.

---

### 4.5 Indicador visual de páginas modificadas

**Qué:** Las páginas que han sido rotadas o movidas de su posición original muestran un indicador visual que las diferencia de las páginas intactas.

**Cómo debe funcionar:**
- **Páginas rotadas:** Un badge circular en la esquina superior derecha con el icono de rotación y el ángulo: `"↻ 90°"` (en `var(--signal)` sobre fondo blanco).
- **Páginas reordenadas:** Si la posición actual de una página difiere de su posición original, mostrar un pequeño badge con la posición original tachada y la nueva: `"3→1"` en tipografía mono diminuta.
- Los badges aparecen con un fade-in de 150ms al producirse el cambio.
- Un resumen textual debajo del grid: `"4 páginas modificadas (2 rotadas, 2 movidas)"`.

**Por qué:** Antes de guardar, el usuario necesita verificar qué ha cambiado. Sin indicadores, tiene que recordar mentalmente qué páginas ha tocado, lo cual es propenso a errores en documentos largos.

---

### 4.6 Insertar páginas de otro PDF

**Qué:** Permitir arrastrar un PDF externo directamente al grid de páginas para insertar sus páginas en una posición específica del documento actual.

**Cómo debe funcionar:**
- Si el usuario arrastra un archivo desde el explorador de archivos del sistema operativo y lo suelta en el grid, el sistema:
  1. Valida que es un PDF válido.
  2. Renderiza las miniaturas de las páginas del nuevo PDF.
  3. Inserta las páginas en la posición donde se soltó el archivo (indicada por una línea de inserción azul entre dos miniaturas existentes).
  4. Las nuevas páginas se muestran con un badge "Nuevo" y un borde azul claro para distinguirlas de las originales.
- Alternativa: un botón "+ Añadir páginas" debajo del grid que abre un diálogo de selección de archivo.

**Por qué:** Combinar las funcionalidades de "Unir" y "Organizar" en un solo flujo. El usuario que está organizando un documento a menudo necesita insertar páginas de otro documento en una posición específica.

---

## 5. 📉 Comprimir PDF

### Estado actual

Selector de 3 niveles (Máxima / Equilibrada / Alta calidad) con progreso textual por página y resultado con comparación de pesos (antes → después, con porcentaje de reducción). La compresión rasteriza las páginas y re-comprime las imágenes en el cliente.

---

### 5.1 Gráfico visual de comparación animado

**Qué:** Reemplazar la comparación textual por un gráfico de barras animado que muestre visualmente la reducción de peso.

**Cómo debe funcionar:**
- Dos barras horizontales, una encima de la otra:
  - **Barra superior (original):** Color `var(--graphite)`, ancho proporcional al peso original. Etiqueta: `"Original: 15.2 MB"`.
  - **Barra inferior (comprimido):** Color `var(--signal)`, ancho proporcional al peso comprimido. Etiqueta: `"Comprimido: 4.1 MB"`.
- Las barras se animan de izquierda a derecha al aparecer (800ms, ease-out). La barra comprimida se anima 200ms después que la original para crear un efecto dramático.
- En el centro, entre ambas barras, un número grande y animado: `"−73%"` que cuenta desde 0% hasta el valor final con un efecto de "counter roll" (500ms).
- El porcentaje cambia de color según la reducción: > 50% verde, 30-50% azul, < 30% naranja.

**Por qué:** Los números por sí solos no generan una reacción emocional. Un gráfico animado con un "−73%" grande en verde genera una reacción de "¡guau!" que refuerza el valor de la herramienta.

---

### 5.2 Comparador visual lado a lado (slider de calidad)

**Qué:** Después de comprimir, mostrar una comparación visual tipo "desliza para comparar" entre una página del original y la misma página comprimida.

**Cómo debe funcionar:**
- Renderizar la misma página (la primera, por defecto) con `pdf.js` desde los bytes originales y desde los bytes comprimidos.
- Mostrar ambas imágenes superpuestas, con un divisor vertical arrastrable. A la izquierda se ve la imagen original, a la derecha la comprimida.
- El divisor es una línea de 2px con un handle circular de 32px en el centro con un icono de `←→`.
- Etiquetas sobre cada lado: `"Original"` y `"Comprimido"`.
- Un selector de página permite comparar diferentes páginas: `"Comparando página [1 ▾] de 12"`.

**Por qué:** El usuario quiere saber si la calidad visual es aceptable antes de descargar. Esto es especialmente importante para documentos con fotos o gráficos donde la degradación puede ser inaceptable.

---

### 5.3 Barra de progreso circular animada

**Qué:** Reemplazar el texto "Comprimiendo página X de Y" por una barra de progreso circular (donut chart) animada.

**Cómo debe funcionar:**
- Un círculo SVG de 80px de diámetro con trazo animado (`stroke-dasharray` / `stroke-dashoffset`).
- En el centro del círculo, el porcentaje numérico: `"45%"`, con el número de la página debajo en texto pequeño: `"pág. 5/12"`.
- El color del trazo progresa gradualmente de `var(--signal)` (teal) a `var(--signal-deep)` (teal oscuro) conforme avanza.
- Al completarse (100%), el círculo hace un flash de brillo y se transforma en un checkmark animado (trazo SVG path animation).

**Por qué:** Un indicador visual circular es más compacto y visualmente atractivo que texto plano. Transmite progreso de forma inmediata e intuitiva.

---

### 5.4 Estimación de tiempo restante

**Qué:** Mostrar el tiempo restante estimado debajo de la barra de progreso.

**Cómo debe funcionar:**
- Calcular el tiempo promedio por página basándose en las páginas ya procesadas: `(tiempo_transcurrido / páginas_hechas) × páginas_restantes`.
- Mostrar: `"~30s restantes"`. Actualizar cada 2 segundos.
- Si el tiempo estimado es > 60s: `"~1 min 20s restantes"`.
- No mostrar la estimación hasta que se hayan procesado al menos 2 páginas (para que el promedio sea mínimamente fiable).

**Por qué:** Sin estimación de tiempo, el usuario no sabe si tiene que esperar 5 segundos o 5 minutos. Esto genera ansiedad e impaciencia, especialmente con documentos largos.

---

### 5.5 Compresión inteligente automática

**Qué:** Analizar las imágenes internas del PDF antes de comprimir y sugerir automáticamente el nivel óptimo de compresión.

**Cómo debe funcionar:**
- Antes de que el usuario pulse "Comprimir", el sistema analiza brevemente el PDF:
  - Si tiene muchas imágenes de alta resolución: sugerir "Máxima compresión" con nota `"Este PDF contiene imágenes de alta resolución. Se puede reducir mucho sin pérdida visible."`.
  - Si tiene pocas imágenes o son de baja resolución: sugerir "Alta calidad" con nota `"Este PDF ya es bastante ligero. Una compresión agresiva podría degradar la calidad."`.
  - Si es principalmente texto: mostrar aviso `"Este PDF es principalmente texto. La compresión puede tener poco efecto."`.
- El nivel sugerido se preselecciona automáticamente con un badge `"Recomendado"`, pero el usuario puede cambiar a otro nivel.

**Por qué:** La mayoría de usuarios no saben qué nivel de compresión elegir. Una recomendación inteligente reduce la fricción de decisión y mejora los resultados.

---

## 6. 💧 Marca de Agua (Watermark)

### Estado actual

Controles de texto libre, 4 colores predefinidos, sliders de opacidad/tamaño/rotación, y checkbox de mosaico. Sin vista previa en vivo.

---

### 6.1 Vista previa en vivo

**Qué:** Una miniatura de la primera página del PDF con la marca de agua renderizada encima en tiempo real, actualizándose instantáneamente conforme el usuario cambia los parámetros.

**Cómo debe funcionar:**
- La miniatura se renderiza con `pdf.js` una sola vez (al cargar el PDF). Sobre ella, se superpone un canvas HTML5 o un `div` con CSS que simula la marca de agua usando exactamente los mismos parámetros que el usuario está configurando.
- **Texto:** Renderizado con CSS (`font-size`, `color`, `opacity`, `transform: rotate(Xdeg)`) directamente sobre la miniatura.
- **Mosaico:** Si está activado, el texto se repite en un patrón CSS `background: repeating` (o múltiples `div`s posicionados con el mismo ángulo).
- **Actualización:** Sin debounce. Cada cambio de slider/input actualiza la preview instantáneamente (los cambios CSS son nativos y no requieren re-renderizado).
- **Posición del preview:** A la derecha del panel de configuración en escritorio (240px de ancho), o encima del panel en móvil.
- **Indicador:** Un badge `"Vista previa"` semitransparente en la esquina de la miniatura para que el usuario sepa que no es el resultado final.

**Por qué:** Sin preview, el usuario tiene que: configurar → procesar → descargar → abrir → comprobar → si no le gusta, volver a empezar. Con preview en vivo, el ciclo es: configurar hasta que quede bien → procesar.

---

### 6.2 Marca de agua con imagen (logo)

**Qué:** Además de texto, permitir subir una imagen PNG/JPG como marca de agua (logo de empresa, firma escaneada).

**Cómo debe funcionar:**
- Un toggle o pestañas: `[Texto] [Imagen]`.
- En modo imagen, un dropzone pequeño o botón para subir la imagen.
- La imagen se muestra en la preview con los mismos controles de opacidad, tamaño y rotación.
- Opción de mosaico: repite la imagen en un patrón regular.
- Al procesar, la imagen se incrusta en cada página usando `pdf-lib` (`pdfDoc.embedPng/embedJpg`).

**Por qué:** Las empresas necesitan estampar su logo en documentos, no solo texto. Es el caso de uso corporativo más demandado.

---

### 6.3 Selector de color libre (color picker completo)

**Qué:** Ampliar los 4 colores predefinidos con un selector de color completo (rueda de color o input hex).

**Cómo debe funcionar:**
- Los 4 botones de color actuales se mantienen como "acceso rápido".
- A la derecha, un botón `+` circular que abre un color picker nativo (`<input type="color">`) estilizado con un borde redondeado que muestra el color seleccionado.
- El color personalizado se muestra como un 5º botón en la fila, con el color elegido.
- Se almacena en `localStorage` el último color personalizado usado para que persista entre sesiones.

**Por qué:** Los 4 colores predefinidos no cubren las necesidades de branding corporativo (ej: una empresa cuyo color es #1a5276).

---

### 6.4 Presets rápidos de texto

**Qué:** Chips/botones que rellenan el campo de texto con valores comunes al hacer clic.

**Cómo debe funcionar:**
- Una fila de chips debajo del campo de texto: `[CONFIDENCIAL] [BORRADOR] [COPIA] [APROBADO] [MUESTRA] [NO VÁLIDO]`.
- Al hacer clic en un chip, se rellena el input de texto con ese valor. El chip se resalta temporalmente (100ms de background coloreado).
- Si el texto del input ya coincide con un chip, ese chip se muestra como "activo" (borde sólido).
- Los chips se renderizan con tipografía mono, tamaño pequeño (text-xs), y estilos pill (rounded-full, border).

**Por qué:** "CONFIDENCIAL" es con diferencia la marca de agua más usada. En vez de escribirla manualmente (y posiblemente con errores tipográficos), un clic lo resuelve.

---

### 6.5 Posicionamiento visual con rejilla de 9 posiciones

**Qué:** Un diagrama interactivo de una página con 9 puntos clicables (3×3: esquinas, centros de lados, centro) para elegir la posición de la marca de agua.

**Cómo debe funcionar:**
- Un rectángulo de 120×160px que representa una página, dividido en una cuadrícula 3×3.
- En cada intersección, un punto clicable de 12px de diámetro. El punto activo es `var(--signal)`, los demás son `var(--line)`.
- Al hacer clic en un punto, la marca de agua se reposiciona inmediatamente en la preview.
- Etiquetas al hacer hover sobre cada punto: "Arriba izquierda", "Centro", "Abajo derecha", etc.
- Posiciones: `top-left`, `top-center`, `top-right`, `center-left`, `center`, `center-right`, `bottom-left`, `bottom-center`, `bottom-right`.

**Por qué:** Mucho más intuitivo que un dropdown de texto. El usuario ve la página y "toca" donde quiere la marca.

---

### 6.6 Aplicar solo a ciertas páginas

**Qué:** Opción de aplicar la marca de agua solo a un rango de páginas, no a todas.

**Cómo debe funcionar:**
- Un campo adicional debajo de los controles principales: `"Aplicar a: [Todas las páginas ▾]"`.
- Al desplegar: `[Todas las páginas] [Páginas pares] [Páginas impares] [Rango personalizado]`.
- En "Rango personalizado", aparece un input para escribir rangos: `"1-3, 5, 8-10"`.
- En la preview, las páginas que recibirán la marca se indican con un check, y las que no, con un badge "Sin marca".

**Por qué:** Es común querer marcar solo el cuerpo del documento pero no la portada, ni el índice, ni los anexos.

---

## 7. 🔢 Números de Página

### Estado actual

5 posiciones (texto), 3 formatos, número inicial configurable. Sin preview.

---

### 7.1 Vista previa en vivo

**Qué:** Una miniatura de página con el número renderizado en la posición seleccionada, actualizándose en tiempo real.

**Cómo debe funcionar:**
- Misma mecánica que la preview de la marca de agua (miniatura de `pdf.js` + overlay CSS).
- El número se renderiza como un `<span>` posicionado absolutamente sobre la miniatura, usando la posición, formato y tamaño configurados.
- Se muestra el número que tendría esa página con el `startAt` configurado (ej: si `startAt=3`, la primera página muestra "3").

**Por qué:** Sin preview, el usuario no sabe cómo quedará el número de página hasta que procese y descargue el PDF.

---

### 7.2 Mapa visual de posiciones clicable

**Qué:** Reemplazar los botones de texto ("Abajo centro", "Arriba dcha.") por un diagrama interactivo de página con puntos clicables.

**Cómo debe funcionar:**
- Un rectángulo estilizado como una página de documento (fondo blanco, sombra suave) de 100×140px.
- 5 puntos clicables en las posiciones reales: `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`.
- Al seleccionar un punto, se muestra un mini-número de ejemplo en la posición exacta (ej: "3" en font-mono diminuto), y la preview se actualiza.
- El punto activo pulsa suavemente con una animación de `scale: 1 → 1.2 → 1` (400ms, ease-in-out, loop infinito) para que sea visualmente distinguible.

**Por qué:** Los botones de texto requieren que el usuario "traduzca mentalmente" la posición. El diagrama visual elimina esa traducción.

---

### 7.3 Color y tipografía configurables

**Qué:** Añadir un selector de color y tipografía para los números de página (actualmente hardcoded a negro y Helvetica 11pt).

**Cómo debe funcionar:**
- Selector de color: Misma mecánica que el de la marca de agua (colores rápidos + picker personalizado).
- Selector de tipografía: Dropdown con las fuentes disponibles de `pdf-lib` (Helvetica, Times Roman, Courier). Mostrar una preview del número en cada fuente dentro del dropdown.
- Slider de tamaño: De 8pt a 16pt.
- Todos los cambios se reflejan en la preview en vivo.

**Por qué:** Un número de página en rojo Times Roman 14pt tiene un uso diferente a uno en negro Helvetica 9pt. El usuario necesita control estético.

---

### 7.4 Excluir páginas del numerado

**Qué:** Permitir excluir páginas específicas del numerado (ej: no numerar la portada ni el índice).

**Cómo debe funcionar:**
- Un input debajo de "Empezar en": `"Omitir páginas: [___]"` donde se pueden escribir rangos: `"1, 2"` (omitir las dos primeras).
- Las páginas omitidas no reciben número pero SÍ se cuentan en la secuencia (o no, según un checkbox: `"☐ Las páginas omitidas no cuentan en la secuencia"`).
- Ejemplo: Si se omiten las páginas 1-2 y se empieza en 1: la página 3 del PDF muestra "1", la página 4 muestra "2", etc.
- Ejemplo alternativo (checkbox activado): Si se omiten 1-2 y se empieza en 1: la página 3 muestra "3", la página 4 muestra "4", etc.

**Por qué:** Caso de uso académico estándar: la portada y el índice de un TFG no se numeran, pero las páginas sí cuentan en la secuencia.

---

### 7.5 Formato personalizable con plantilla

**Qué:** Además de los 3 formatos predefinidos, permitir escribir un formato personalizado con variables.

**Cómo debe funcionar:**
- Un input de texto con placeholder: `"{n} de {total}"`.
- Variables disponibles: `{n}` (número de página), `{total}` (total de páginas), `{N}` (con padding de ceros: 001, 002).
- Ejemplo: `"Pág. {n}/{total} — Mi Empresa"` produce `"Pág. 3/15 — Mi Empresa"`.
- La preview se actualiza en tiempo real al escribir en el template.
- Los 3 formatos predefinidos se muestran como "sugerencias" clicables que rellenan el input.

**Por qué:** Los 3 formatos predefinidos no cubren todos los casos. Algunas empresas tienen formatos de numeración muy específicos.

---

## 8. 🖼️ Imágenes a PDF (JPG/PNG → PDF)

### Estado actual

Grid de miniaturas con flechas ↑↓ para reordenar, selector de tamaño de página (A4, Carta, Ajustar a imagen). Sin drag & drop para reordenar, sin rotación, sin control de márgenes.

---

### 8.1 Drag & drop para reordenar imágenes

**Qué:** SortableJS en el grid de imágenes, con handles de arrastre.

**Cómo debe funcionar:**
- Misma mecánica que el organizador de páginas: handle de `GripVertical` en cada miniatura, animación de arrastre de 160ms, ghost con opacidad 40%.
- Las flechas ↑↓ se mantienen como alternativa accesible.

**Por qué:** Coherencia con el resto de herramientas que usan drag & drop. El usuario ya aprendió el patrón en el organizador.

---

### 8.2 Preview de imagen dentro del marco de página

**Qué:** Cada miniatura muestra la imagen dentro de un borde/marco que representa la página A4/Carta seleccionada, para visualizar cómo encajará.

**Cómo debe funcionar:**
- El contenedor de cada miniatura tiene un aspect-ratio fijo de la página seleccionada (A4 = 210/297 ≈ 0.707, Carta = 216/279 ≈ 0.774).
- La imagen se muestra centrada dentro de ese marco, escalada para ajustarse manteniendo proporciones (`object-fit: contain`).
- Los márgenes (si los hay) se muestran como espacio blanco alrededor de la imagen.
- Si se selecciona "Ajustar a la imagen", el marco se adapta a las proporciones de cada imagen individual.

**Por qué:** El usuario necesita ver cómo quedará cada imagen dentro de la página antes de generar el PDF. Una foto panorámica en A4 vertical tendrá grandes espacios en blanco arriba y abajo, lo cual el usuario quizás no espera.

---

### 8.3 Rotación individual por imagen

**Qué:** Botón de rotación de 90° en cada miniatura, como en el organizador.

**Cómo debe funcionar:**
- Botón con icono `RotateCw` en la barra inferior de cada miniatura (junto a las flechas ↑↓ y ✕).
- Rotación visual con la misma animación suave de 300ms.
- La rotación se aplica al incrustar la imagen en el PDF (rotando el canvas antes de embedirla en `pdf-lib`).

**Por qué:** Las fotos del móvil a menudo están giradas. El usuario necesita corregirlas antes de crear el PDF.

---

### 8.4 Selector de márgenes

**Qué:** Control para definir el margen entre el borde de la página y la imagen.

**Cómo debe funcionar:**
- Un dropdown o slider: `[Sin margen] [Margen normal (15mm)] [Margen amplio (25mm)]`.
- El cambio se refleja inmediatamente en las previews del grid (la imagen se reduce dentro del marco de página mostrando el margen blanco).
- En modo "Ajustar a la imagen", los márgenes añaden espacio blanco alrededor de la imagen.

**Por qué:** Para impresión, los márgenes son esenciales (las impresoras no imprimen los bordes). Sin márgenes, la imagen se cortaría al imprimir.

---

### 8.5 Opción de orientación por página

**Qué:** Un toggle para alternar entre orientación vertical y horizontal para cada imagen o para todo el documento.

**Cómo debe funcionar:**
- Un toggle global: `[Vertical] [Horizontal] [Automático]`.
- En modo "Automático", cada imagen se coloca en la orientación que mejor se adapte a su relación de aspecto (las panorámicas van horizontal, las verticales van vertical). Esta es la opción predeterminada y la más inteligente.
- Se puede sobrescribir por imagen individual con un botón de toggle en la miniatura.

**Por qué:** Una foto panorámica en página vertical desperdicia espacio. En automático, el sistema toma la mejor decisión por el usuario.

---

### 8.6 Modo álbum (múltiples imágenes por página)

**Qué:** En vez de una imagen por página, permitir layouts de 2×1, 2×2, o 3×3 imágenes por página.

**Cómo debe funcionar:**
- Un selector de layout visual: cuadrados pequeños que muestran la distribución:
  - `[1×1]` (una imagen por página, actual).
  - `[2×1]` (dos imágenes apiladas verticalmente).
  - `[2×2]` (cuatro imágenes, 2 filas × 2 columnas).
  - `[3×3]` (nueve imágenes por página).
- El grid de previews se actualiza para reflejar la agrupación: cada "tarjeta" del grid muestra la página completa con todas las imágenes que le corresponden.
- El número de imágenes sobrantes se muestra: `"12 imágenes → 3 páginas (2×2)"`.

**Por qué:** Caso de uso de impresión de fotos. Imprimir 50 fotos a 1 por página son 50 páginas. A 4 por página son 13.

---

## 9. 📷 PDF a Imágenes (JPG / PNG)

### Estado actual

Selector de formato (PNG/JPG), progreso por página, descarga automática (1 imagen si 1 página, ZIP si varias).

---

### 9.1 Selector de resolución/DPI

**Qué:** Control para elegir la resolución de las imágenes exportadas.

**Cómo debe funcionar:**
- Tres botones: `[72 DPI · Pantalla] [150 DPI · Estándar] [300 DPI · Impresión]`.
- Internamente, el DPI se traduce al parámetro `scale` de `pdf.js` (`renderPageThumbnail`): scale 1 ≈ 72 DPI, scale 2 ≈ 150 DPI, scale ~4 ≈ 300 DPI.
- Al seleccionar una resolución, mostrar la estimación de peso por imagen y total: `"~350 KB/imagen · ~4.2 MB total (12 páginas)"`.
- Un aviso para 300 DPI: `"⚠️ Las imágenes de alta resolución pueden tardar más en generarse y ocupar más espacio."`.

**Por qué:** 72 DPI es suficiente para compartir por chat; 300 DPI es necesario para impresión profesional. El usuario necesita este control.

---

### 9.2 Galería de preview antes de descargar

**Qué:** Después de generar las imágenes, mostrar una galería visual de todas ellas antes de descargar.

**Cómo debe funcionar:**
- Un grid de miniaturas (similar al del organizador) mostrando todas las imágenes generadas.
- Cada miniatura tiene:
  - El número de página: `"Pág. 1"`.
  - El peso del archivo: `"245 KB"`.
  - Un botón de descarga individual (icono ↓).
- Al hacer clic en una miniatura, se abre un lightbox con la imagen a tamaño completo y un botón grande de "Descargar esta imagen".
- Un botón principal debajo del grid: `"Descargar todas (ZIP · 4.2 MB)"`.
- Un botón secundario: `"Descargar seleccionadas"` (con checkboxes en cada miniatura).

**Por qué:** El flujo actual descarga directamente sin dejar al usuario inspeccionar la calidad. Si solo necesita 3 de las 20 páginas convertidas, tiene que descargar las 20 y eliminar 17 manualmente.

---

### 9.3 Selección de páginas a convertir

**Qué:** Antes de generar, permitir seleccionar qué páginas convertir (no todas obligatoriamente).

**Cómo debe funcionar:**
- Mostrar el grid de miniaturas del PDF original (con `usePdfThumbnails`) con checkboxes de selección (misma interfaz que el SplitTool).
- Botones "Todas" / "Ninguna" y campo de rangos.
- Solo las páginas seleccionadas se convierten, reduciendo tiempo y peso.

**Por qué:** Si un PDF tiene 50 páginas pero el usuario solo necesita convertir la portada y un gráfico de la página 23, no debería tener que convertir las 50.

---

## 10. 📝 PDF a Texto

### Estado actual

Extrae texto, lo muestra en un textarea readonly con progreso por página. Botones de copiar al portapapeles y descargar como .txt.

---

### 10.1 Separación visual por páginas

**Qué:** Insertar marcadores visuales en el texto extraído que separen el contenido de cada página.

**Cómo debe funcionar:**
- Insertar separadores en el texto extraído: `"\n\n━━━━━ Página 3 ━━━━━\n\n"` entre el contenido de cada página.
- En el textarea, estos separadores se renderizan como texto normal pero son visualmente distinguibles por los caracteres decorativos.
- Alternativa superior: migrar de `<textarea readonly>` a un `<div>` con estilos personalizados donde los separadores sean `<hr>` reales con el número de página en un badge centrado.

**Por qué:** En un textarea de 20 páginas de texto corrido, el usuario pierde toda noción de estructura. Los separadores restauran la orientación.

---

### 10.2 Buscador con resaltado (Ctrl+F nativo mejorado)

**Qué:** Un campo de búsqueda integrado que resalte las coincidencias dentro del texto extraído.

**Cómo debe funcionar:**
- Un input de búsqueda encima del textarea con icono de lupa.
- Al escribir, todas las coincidencias se resaltan con `<mark>` (fondo amarillo) si se migra a un `<div>`.
- Si se mantiene el `<textarea>`, usar la búsqueda nativa del navegador (`Ctrl+F`), pero añadir un botón que active el diálogo del navegador.
- Contador de resultados: `"4 de 23 coincidencias"` con flechas ↑↓ para saltar entre ellas.

**Por qué:** El usuario que extrae texto generalmente busca una información específica dentro del documento. Un buscador integrado acelera este proceso.

---

### 10.3 Formato Markdown como opción de salida

**Qué:** Un toggle para exportar el texto en formato Markdown en vez de texto plano, intentando preservar la estructura del documento (títulos, listas, negritas).

**Cómo debe funcionar:**
- Toggle: `[Texto plano] [Markdown]`.
- El sistema analiza el texto extraído y aplica heurísticas:
  - Líneas en tamaño de fuente mayor → `# Título` o `## Subtítulo`.
  - Líneas que empiezan por `•`, `-`, `*`, o números → listas Markdown.
  - Texto en negrita → `**texto**`.
- El resultado no será perfecto pero será significativamente más útil que texto plano para documentos bien estructurados.
- El botón de descarga cambia a `"Descargar .md"`.

**Por qué:** El texto plano pierde toda la estructura visual. Markdown es un formato intermedio que preserva la jerarquía y es universalmente compatible.

---

### 10.4 Indicador de calidad de extracción

**Qué:** Un badge que indique al usuario la calidad estimada de la extracción.

**Cómo debe funcionar:**
- Después de extraer, analizar métricas simples:
  - **Ratio de caracteres útiles:** Si el texto tiene alta proporción de caracteres ilegibles (secuencias de símbolos, caracteres unicode extraños), mostrar: `"⚠️ El texto extraído puede contener errores. El PDF podría ser un escaneo."`.
  - **Texto vacío o muy corto:** `"⚠️ Se extrajo muy poco texto. El PDF podría ser una imagen escaneada. Prueba con OCR (próximamente)."`.
  - **Extracción exitosa:** `"✅ Texto extraído correctamente de las 12 páginas."`.
- El badge se muestra encima del textarea con un icono y color apropiados.

**Por qué:** Muchos usuarios no entienden por qué un PDF escaneado produce texto basura. Un indicador claro les explica el problema y les sugiere una solución.

---

### 10.5 Comparador lado a lado (PDF original vs. texto)

**Qué:** Mostrar el PDF original en un panel a la izquierda y el texto extraído a la derecha, sincronizados por página.

**Cómo debe funcionar:**
- Layout de dos columnas: izquierda = renderizado de la página con `pdf.js`, derecha = texto correspondiente a esa página.
- Navegación sincronizada: al cambiar de página en el visor PDF, el texto se desplaza al bloque correspondiente.
- El usuario puede seleccionar texto en cualquiera de los dos paneles.
- Un botón por página en el panel derecho: `"Copiar texto de esta página"`.
- En pantallas < 1024px, se muestran en pestañas `[PDF] [Texto]` en vez de lado a lado.

**Por qué:** El usuario puede verificar línea por línea que la extracción es correcta y detectar errores. Especialmente útil para documentos legales o técnicos.

---

## 11. 📄 Office a PDF (Word, Excel, PowerPoint)

### Estado actual

Dropzone, aviso de privacidad (envío al servidor), conversión vía Gotenberg, preview del resultado. Soporte para múltiples formatos (.docx, .doc, .odt, .xlsx, .xls, .ods, .pptx, .ppt, .odp) diferenciados por preset.

---

### 11.1 Indicador de progreso por fases

**Qué:** Mostrar al usuario en qué fase del proceso se encuentra la conversión, con iconos y animaciones por cada paso.

**Cómo debe funcionar:**
- Un stepper horizontal de 3 fases:
  1. `📤 Subiendo archivo…` (con barra de progreso del upload usando `onUploadProgress` de `axios`).
  2. `⚙️ Convirtiendo…` (spinner con animación de engranaje).
  3. `📥 Descargando resultado…` (barra de progreso del download).
- Cada fase completada muestra un checkmark verde animado.
- La fase activa pulsa suavemente con un efecto de brillo.
- Si una fase tarda más de 10 segundos, mostrar un texto tranquilizador: `"Las conversiones de hojas de cálculo pueden tardar un poco más."`.

**Por qué:** La conversión de Office es la única herramienta que envía datos a un servidor. El usuario necesita más feedback que un simple spinner porque hay latencia de red involucrada.

---

### 11.2 Preview de las primeras páginas del resultado

**Qué:** Antes de descargar, mostrar miniaturas de las primeras páginas del PDF resultante.

**Cómo debe funcionar:**
- Usar el `ResultPreview` existente pero ampliado con un grid de miniaturas de las primeras 4-6 páginas.
- El usuario puede verificar que el formato del documento original se conservó (tablas, fuentes, márgenes).
- Un botón de "⟳ Reconvertir" si el resultado no es satisfactorio.

**Por qué:** La conversión de Office no es siempre perfecta. Las tablas complejas, las fuentes no estándar o los gráficos avanzados pueden cambiar. El preview permite detectar problemas antes de descargar.

---

### 11.3 Conversión en lote de múltiples archivos

**Qué:** Permitir subir varios archivos Office a la vez y convertirlos todos a PDF.

**Cómo debe funcionar:**
- El dropzone acepta `multiple`.
- Se muestra una lista de archivos con estado individual por cada uno: `[Subiendo…] [Convirtiendo…] [✅ Listo] [❌ Error]`.
- Las conversiones se ejecutan en paralelo (máximo 3 simultáneas para no sobrecargar Gotenberg).
- Al terminar todas, un botón: `"Descargar todos (ZIP)"` o descargas individuales.
- Si un archivo falla, los demás continúan y el error se muestra solo para ese archivo.

**Por qué:** Convertir 10 documentos uno por uno requiere 10 ciclos de subir → esperar → descargar → volver → subir… La conversión en lote reduce esto a un solo flujo.

---

### 11.4 Indicador de fidelidad de la conversión

**Qué:** Un badge o aviso que indique la calidad estimada de la conversión según el formato de entrada.

**Cómo debe funcionar:**
- Basado en la extensión del archivo y heurísticas conocidas de LibreOffice:
  - `.docx` simple → `"✅ Alta fidelidad esperada"`.
  - `.doc` (formato antiguo) → `"⚠️ El formato .doc puede perder algunos estilos. Recomendamos usar .docx"`.
  - `.xlsx` con muchas hojas → `"ℹ️ Cada hoja se convertirá en una página separada"`.
  - `.pptx` con animaciones → `"ℹ️ Las animaciones y transiciones no se representarán en el PDF"`.
- El aviso se muestra después de seleccionar el archivo y antes de convertir.

**Por qué:** Gestión de expectativas. Es mejor avisar al usuario de posibles limitaciones antes de que descubra un resultado inesperado.

---

## 12. 🏷️ Editar Metadatos

### Estado actual

Formulario con 4 campos editables (Título, Autor, Asunto, Palabras clave). Lee los valores actuales y permite sobrescribirlos.

---

### 12.1 Metadatos de solo lectura adicionales

**Qué:** Mostrar información de solo lectura del documento además de los campos editables.

**Cómo debe funcionar:**
- Una sección superior "Información del documento" con campos no editables:
  - **Fecha de creación** y **fecha de modificación** (formateadas como "27 de junio de 2026, 13:45").
  - **Creador** (software que generó el PDF).
  - **Versión del PDF** (1.4, 1.7, 2.0).
  - **Número de páginas**.
  - **Tamaño del archivo**.
  - **Protegido** (si tiene contraseña).
- Estos campos se muestran en texto gris con etiquetas descriptivas, visualmente separados de los campos editables.

**Por qué:** El usuario que consulta metadatos a menudo necesita saber cuándo se creó el documento o qué software lo generó. Esta información es útil para auditoría, forense digital o simplemente para contexto.

---

### 12.2 Indicador de cambios sin guardar

**Qué:** Marcar visualmente los campos que el usuario ha modificado respecto a los valores originales.

**Cómo debe funcionar:**
- Almacenar los valores originales al cargar (`originalMeta`).
- Comparar en tiempo real con los valores actuales del formulario.
- Los campos modificados muestran un punto naranja (6px, `border-radius: 50%`, color `var(--ember)`) a la izquierda de la etiqueta.
- Un texto resumen debajo del formulario: `"2 campos modificados"` (o `"Sin cambios"` en gris).
- El botón "Guardar" solo se habilita si hay al menos un cambio.

**Por qué:** El usuario puede perder la pista de qué campos ha editado, especialmente si ha pasado tiempo entre cargar el PDF y pulsar guardar.

---

### 12.3 Botón "Limpiar todos los metadatos"

**Qué:** Un botón que vacía todos los campos editables de una vez, para usuarios que quieren eliminar toda la información personal del PDF antes de compartirlo.

**Cómo debe funcionar:**
- Botón con icono de escoba/barrido: `"🧹 Limpiar todo"`, estilo destructivo (borde rojo suave).
- Al pulsar, todos los campos editables se vacían con una animación de fade-out del texto (200ms).
- Un toast confirmatorio: `"Metadatos limpiados. Pulsa Guardar para aplicar."`.
- Los campos de solo lectura (fecha de creación, etc.) NO se ven afectados (son inherentes al PDF y no se pueden borrar con `pdf-lib`).

**Por qué:** Caso de uso de privacidad: antes de compartir un documento, el usuario quiere eliminar el nombre del autor, el título de su unidad de red, etc.

---

### 12.4 Chips de palabras clave

**Qué:** Reemplazar el input de texto libre de palabras clave por un sistema de chips (tags) individuales.

**Cómo debe funcionar:**
- El campo "Palabras clave" se transforma en un contenedor de chips.
- Las palabras clave existentes (separadas por comas en el PDF original) se parsean y se muestran como chips individuales: `[SEO ✕] [marketing ✕] [2026 ✕]`.
- Un input de texto dentro del contenedor permite escribir nuevas palabras clave. Al pulsar `Enter` o `,`, se crea un nuevo chip.
- Cada chip tiene un botón ✕ para eliminarlo individualmente.
- Los chips se estilizan con fondo `var(--ink)/5`, borde redondeado `rounded-full`, padding `px-2 py-0.5`, texto `text-xs`.

**Por qué:** El texto libre separado por comas es difícil de leer y editar (¿dónde empieza y termina cada palabra clave?). Los chips ofrecen una representación visual clara y una edición más rápida.

---

### 12.5 Autocompletar de autor

**Qué:** Sugerir automáticamente el nombre del autor basándose en los documentos procesados previamente.

**Cómo debe funcionar:**
- Al escribir en el campo "Autor", mostrar un dropdown con sugerencias basadas en los últimos 10 autores únicos almacenados en `localStorage`.
- Las sugerencias se filtran por lo que el usuario ha escrito (match parcial, case-insensitive).
- Seleccionar una sugerencia rellena el campo.
- Si el historial está vacío, no se muestra nada.

**Por qué:** Si el usuario siempre usa el mismo nombre de autor ("Juan García López"), escribirlo completo cada vez es tedioso. El autocompletar resuelve esto en 2 clics.

---

## 13. 🌐 Mejoras Transversales (todas las herramientas)

### 13.1 Animación de dropzone enriquecida

**Qué:** El dropzone (área de subida de archivos) debe sentirse vivo e invitante, no como un rectángulo estático.

**Cómo debe funcionar:**
- **Estado base:** Borde de 2px dashed con color suave (`var(--line)`), icono de nube/upload pulsando suavemente (animación `scale: 1 → 1.05 → 1` cada 2s, infinita).
- **Hover (sin archivo):** El borde se anima a `var(--signal)`, el fondo se tiñe ligeramente (`var(--signal)/5`), el icono se agranda suavemente a 1.1× y cambia de color a `var(--signal)`. Transición de 200ms.
- **Drag sobre el dropzone (con archivo):** Efecto de "magnetismo": el borde se convierte en sólido y pulsa, el fondo brilla con una ondulación radial suave desde el centro. Texto cambia a `"¡Suéltalo aquí!"` con animación de bounce.
- **Drop exitoso:** Flash de confetti suave (5-8 partículas en colores de la app) que se disipan en 600ms. El icono se transforma en un checkmark con trazo SVG animado.
- **Drop fallido (formato inválido):** Shake horizontal del borde (3 oscilaciones en 400ms), borde rojo momentáneo (300ms), icono de advertencia.

**Por qué:** El dropzone es la primera interacción del usuario con cada herramienta. Una animación premium transmite calidad y profesionalismo desde el primer contacto.

---

### 13.2 Toast de éxito animado

**Qué:** Al completar exitosamente cualquier operación (unir, dividir, comprimir, etc.), mostrar un toast flotante con confirmación.

**Cómo debe funcionar:**
- **Posición:** Esquina inferior derecha, 16px de margen.
- **Contenido:** Icono de checkmark verde + texto descriptivo: `"✅ PDF comprimido · -67% · 2.1 MB"`.
- **Animación de entrada:** Desliza desde la derecha (`translateX: 100% → 0`) + fade in, 300ms ease-out.
- **Duración:** 4 segundos, con barra de progreso diminuta (2px, color signal) que se agota visualmente.
- **Animación de salida:** Desliza hacia la derecha + fade out, 200ms.
- **Interacción:** Hover pausa el temporizador. Clic en ✕ cierra inmediatamente.
- **Estilo:** Fondo `var(--paper-raised)`, sombra `0 4px 16px rgba(0,0,0,0.12)`, borde izquierdo de 3px en `var(--signal)`.

**Por qué:** Feedback positivo inmediato refuerza la confianza del usuario y le confirma que la operación se completó sin necesidad de inspeccionar el resultado.

---

### 13.3 Overlay de atajos de teclado

**Qué:** Un modal que lista todos los atajos de teclado disponibles, accesible con la tecla `?` o desde un botón de ayuda.

**Cómo debe funcionar:**
- **Activación:** Pulsar `?` (fuera de inputs de texto) o clic en un botón `⌨️` en el footer.
- **Contenido:** Tabla de atajos agrupados por contexto:
  - **General:** `Ctrl+Z` Deshacer, `Ctrl+Y` Rehacer, `Escape` Deseleccionar, `?` Atajos.
  - **Editor:** `Ctrl+D` Duplicar, `Delete` Borrar, `Ctrl+Shift+F` Pantalla completa, flechas para mover, `Ctrl+G` Grid.
  - **Navegación:** `←` `→` Página anterior/siguiente.
- **Estilo:** Modal centrado con fondo blur, teclas renderizadas como `<kbd>` con estilo de tecla física (fondo gris claro, borde inferior de 2px para efecto 3D, fuente mono).
- **Cierre:** `Escape` o clic fuera del modal.

**Por qué:** Los power users (que son quienes más usan herramientas de PDF) esperan atajos de teclado. Descubrirlos mediante un overlay accesible es la mejor práctica.

---

### 13.4 Badge de privacidad animado durante el procesamiento

**Qué:** Mientras se procesa un archivo en el cliente, un badge prominente muestra que los datos no salen del navegador.

**Cómo debe funcionar:**
- Un badge flotante que aparece durante el procesamiento: `"🔒 Procesando en tu dispositivo"`.
- El icono de candado tiene una animación sutil de "cierre" al inicio del procesamiento (el arco del candado se cierra, trazo SVG de 300ms).
- Posición: junto al indicador de progreso o en la esquina superior derecha del área de trabajo.
- Desaparece con el resultado.
- **Excepción para Office:** Para las herramientas que sí envían al servidor, el badge cambia a `"☁️ Procesando en servidor privado"` con color diferente (naranja en vez de teal).

**Por qué:** La propuesta de valor principal del proyecto es la privacidad. Reforzar este mensaje en cada uso consolida la confianza del usuario.

---

### 13.5 Modo oscuro

**Qué:** Un tema oscuro completo y coherente que el usuario pueda activar.

**Cómo debe funcionar:**
- Toggle en el header: icono de sol/luna que alterna entre modos.
- Se detecta la preferencia del sistema (`prefers-color-scheme: dark`) al primer acceso.
- La selección se almacena en `localStorage`.
- Todos los tokens CSS (`--paper`, `--ink`, `--line`, `--graphite`, etc.) tienen variantes dark definidas en `:root[data-theme="dark"]`.
- Las miniaturas de PDF y previews mantienen su fondo blanco (porque el PDF real es blanco), pero el entorno que las rodea es oscuro.
- Transición suave al cambiar de tema: `transition: background-color 200ms, color 200ms` en `body`.

**Por qué:** El modo oscuro no es solo estético; reduce la fatiga visual en sesiones largas de edición y es una expectativa de cualquier herramienta web moderna.

---

### 13.6 Encadenamiento visual mejorado entre herramientas

**Qué:** Al completar una operación, sugerir la siguiente herramienta lógica con chips clicables.

**Cómo debe funcionar:**
- En la pantalla de resultado (`ResultPreview`), debajo de los botones de descarga, una sección: `"¿Qué quieres hacer ahora?"`.
- Se muestran 2-3 chips con herramientas relevantes según la herramienta actual:
  - Después de **Unir:** `[Comprimir] [Organizar] [Editar]`.
  - Después de **Dividir:** `[Unir con otro PDF] [Comprimir]`.
  - Después de **Editar:** `[Comprimir] [Marca de agua] [Números de página]`.
  - Después de **Comprimir:** `[Descargar] [Editar]`.
  - Después de **Office a PDF:** `[Editar] [Comprimir] [Marca de agua]`.
- Al hacer clic en un chip, el resultado actual se pasa como input a la siguiente herramienta (mecanismo de "handoff" que ya existe en el código).

**Por qué:** Muchos flujos de trabajo son cadenas: convertir Word → comprimir → añadir marca de agua. Sin sugerencias, el usuario tiene que volver al inicio, buscar la herramienta y volver a cargar el archivo.

---

### 13.7 Onboarding interactivo (tour de primera vez)

**Qué:** La primera vez que un usuario accede a una herramienta, un tour guiado señala los controles principales con tooltips paso a paso.

**Cómo debe funcionar:**
- El tour se activa solo la primera vez (flag en `localStorage`: `tour-{toolId}-done`).
- Se compone de 3-4 pasos, cada uno con un tooltip que señala un elemento de la interfaz:
  1. `"Arrastra tu archivo aquí o haz clic para seleccionarlo"` → apunta al dropzone.
  2. `"Ajusta las opciones a tu gusto"` → apunta al panel de configuración.
  3. `"Pulsa aquí cuando estés listo"` → apunta al botón de acción.
- Cada tooltip tiene: texto descriptivo, botón "Siguiente" / "Terminar", y botón "Saltar tour".
- El elemento señalado se resalta con un halo pulsante (ring de `var(--signal)` con animación), y el resto de la interfaz se atenúa con un overlay semitransparente.
- Un botón `"?" ` en la esquina permite re-activar el tour en cualquier momento.

**Por qué:** Los usuarios nuevos no saben dónde mirar. Un tour de 3 pasos (10 segundos) reduce drásticamente la curva de aprendizaje sin ser invasivo.

---

### 13.8 Drag & drop global (cualquier parte de la web)

**Qué:** Arrastrar un archivo a cualquier parte de la ventana del navegador (no solo al dropzone) activa la zona de drop.

**Cómo debe funcionar:**
- Un listener de `dragenter` en el `document` detecta cuando se arrastra un archivo sobre la ventana.
- Al detectarlo, se muestra un overlay a pantalla completa con fondo semitransparente (`rgba(15,181,166,0.1)`) y un dropzone gigante centrado con texto `"Suelta tu archivo en cualquier parte"` y un icono de descarga animado.
- El overlay se oculta al salir de la ventana (`dragleave` en `document`) o al soltar el archivo.
- Al soltar, se redirige el archivo a la herramienta activa (si hay una) o se detecta el tipo y se sugiere la herramienta apropiada.

**Por qué:** El usuario no debería tener que "buscar" el dropzone. Arrastrar un archivo a cualquier parte de la ventana es la experiencia más fluida posible.
