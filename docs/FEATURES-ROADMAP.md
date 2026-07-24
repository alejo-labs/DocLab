# DocLab — Catálogo de funcionalidades y roadmap

> Investigación para convertir DocLab en la web de PDF **más completa**, sin traicionar la tesis
> **local-first** (procesar en el navegador siempre que sea posible; servidor solo cuando es imprescindible).
> Referencias: [Stirling-PDF](https://docs.stirlingpdf.com/functionality/) (60+ herramientas, open-source),
> [iLovePDF](https://www.ilovepdf.com/features), Smallpdf, Sejda, PDF24.

## Leyenda
- **Proc.**: 🟢 cliente (navegador) · 🟡 servidor efímero · 🔵 cliente con WASM · ✨ IA (Gemini, solo texto)
- **Esfuerzo**: ▁ bajo · ▃ medio · ▅ alto
- **Prioridad**: ⭐⭐⭐ imprescindible · ⭐⭐ alta · ⭐ nice-to-have

---

## ✅ Ya implementado (13 herramientas + IA + previsualización/encadenado)
Unir · Dividir · Extraer páginas · Organizar · Rotar · Eliminar páginas · JPG→PDF · PDF→JPG · PDF→PNG ·
Comprimir (cliente) · Word/Excel/PowerPoint→PDF (Gotenberg) · Buscador local + IA (Gemini) · Previsualización
de resultado + encadenado.

---

## A. Organizar páginas (casi todo 🟢 con pdf-lib)
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| Números de página | 🟢 | pdf-lib `drawText` | ▁ | ⭐⭐⭐ | Posición/formato/rango. Quick win. |
| Insertar páginas en blanco | 🟢 | pdf-lib | ▁ | ⭐ | |
| Quitar páginas en blanco (auto) | 🟢 | pdf.js render + análisis | ▃ | ⭐ | Detecta páginas casi vacías. |
| N-up (2/4/6 págs por hoja) | 🟢 | pdf-lib | ▃ | ⭐⭐ | Ahorro papel; "Multi-Page Layout". |
| Recortar (crop) | 🟢 | pdf-lib `setCropBox` + UI | ▃ | ⭐⭐ | Selección visual de área. |
| Escalar/redimensionar páginas | 🟢 | pdf-lib | ▁ | ⭐ | A4↔Carta, ajustar. |
| Dividir por tamaño / cada N págs | 🟢 | pdf-lib | ▁ | ⭐⭐ | Variantes de Dividir. |
| Cuadernillo (booklet) | 🟢 | pdf-lib | ▃ | ⭐ | Imposición para imprimir y plegar. |

## B. Convertir A PDF
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| TXT→PDF | 🟢 | pdf-lib | ▁ | ⭐ | |
| Markdown→PDF | 🟢 | marked + pdf-lib/print | ▃ | ⭐ | |
| HTML→PDF | 🟡 | Gotenberg (Chromium) | ▃ | ⭐ | Solo archivos subidos, no URLs (anti-SSRF). |

## C. Convertir DESDE PDF
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| **PDF→Texto** | 🟢 | pdf.js `getTextContent` | ▁ | ⭐⭐⭐ | Quick win, muy pedido. |
| PDF→PDF/A (archivado) | 🟡 | Ghostderberg/Ghostscript | ▃ | ⭐ | Cumplimiento legal. |
| PDF→Word (.docx) | 🟡 | LibreOffice / pdf2docx | ▅ | ⭐⭐ | Complejo; calidad variable. Servicio Python. |
| PDF→Excel (tablas) | 🟡 | camelot/tabula (Python) | ▅ | ⭐ | Extracción de tablas, difícil. |
| PDF→PowerPoint | 🟡 | — | ▅ | ⭐ | Difícil, baja fidelidad. |

## D. Optimizar
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| Comprimir PRO (mantiene texto) | 🟡 | Ghostscript `-dPDFSETTINGS` | ▃ | ⭐⭐ | Upgrade del compresor actual (raster). |
| Reparar PDF | 🟡/🔵 | qpdf / Ghostscript | ▃ | ⭐ | Recupera archivos dañados. |
| Optimizar para web (linearize) | 🟡 | qpdf | ▁ | ⭐ | |

## E. Editar (🟢 pdf-lib + pdf.js)
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| **Editor PDF** (texto, imágenes, formas, dibujo, resaltado) | 🟢 | pdf.js (render) + canvas + pdf-lib | ▅ | ⭐⭐⭐ | **El gran diferenciador.** Anotar y editar sobre la página. |
| **Marca de agua** (texto/imagen) | 🟢 | pdf-lib | ▃ | ⭐⭐⭐ | Opacidad, rotación, mosaico. Quick win alto valor. |
| Sello/estampa de imagen | 🟢 | pdf-lib | ▁ | ⭐⭐ | |
| **Editar metadatos** | 🟢 | pdf-lib `setTitle/Author...` | ▁ | ⭐⭐ | Quick win. |
| Aplanar (flatten) | 🟢 | pdf-lib `form.flatten()` | ▁ | ⭐⭐ | |
| Quitar anotaciones | 🟢 | pdf-lib | ▁ | ⭐ | |

## F. Formularios (Fase 4 del plan original)
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| **Rellenar formularios** (AcroForms) | 🟢 | pdf.js / pdf-lib | ▃ | ⭐⭐⭐ | Inputs nativos sobre el PDF. |
| Crear formularios (diseñador) | 🟢 | interact.js + pdf-lib | ▅ | ⭐⭐ | Lienzo para dibujar campos. |
| Detectar campos / exportar JSON | 🟢 | pdf-lib | ▃ | ⭐⭐ | Webhook/integración. |

## G. Seguridad (la tesis del proyecto 🔒)
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| **Redactar** (eliminar info sensible de verdad) | 🟢 | pdf.js raster + cajas → reconstruye | ▅ | ⭐⭐⭐ | Encaja con privacidad. Rasteriza zona → borra texto real. |
| **Proteger con contraseña** | 🔵 | **qpdf-wasm** (cliente) | ▃ | ⭐⭐⭐ | Cifrado AES en el navegador, sin subir nada. |
| Quitar contraseña | 🔵 | qpdf-wasm | ▃ | ⭐⭐ | Requiere la contraseña actual. |
| Cambiar permisos | 🔵 | qpdf-wasm | ▃ | ⭐ | Impresión/copia. |
| Sanitizar (quitar JS/metadatos) | 🟢/🔵 | pdf-lib / qpdf | ▃ | ⭐⭐ | Limpia scripts embebidos. |
| **Firmar** (firma dibujada/imagen) | 🟢 | canvas + pdf-lib | ▃ | ⭐⭐⭐ | Dibuja o sube tu firma. |
| Firma digital certificada (PAdES) | 🟡 | crypto / servidor | ▅ | ⭐ | Validez legal; complejo. |
| Validar firma | 🟡 | — | ▅ | ⭐ | |

## H. IA y avanzado (✨ aprovecha Gemini ya integrado)
| Funcionalidad | Proc. | Lib | Esf. | Prio. | Notas |
|---|---|---|---|---|---|
| **Resumir PDF** | ✨ | pdf.js (texto) → Gemini | ▃ | ⭐⭐⭐ | Gran gancho IA. Solo viaja el texto (opt-in claro). |
| **Chatear con el PDF** (Q&A) | ✨ | texto → Gemini | ▅ | ⭐⭐ | "Pregúntale a tu documento". |
| **Traducir PDF** | ✨ | texto → Gemini | ▃ | ⭐⭐ | |
| **Comparar dos PDF** (diff) | 🟢 | pdf.js texto + diff / píxeles | ▃ | ⭐⭐ | Cambios lado a lado. |
| **OCR** (escaneado→buscable) | 🔵 | **tesseract.js** (WASM) | ▅ | ⭐⭐⭐ | 100% local, encaja con la tesis. |
| Extraer imágenes del PDF | 🟢 | pdf.js | ▃ | ⭐⭐ | |
| Inspector / info del PDF | 🟢 | pdf-lib/pdf.js | ▁ | ⭐ | Metadatos, fuentes, tamaño. |

---

## Roadmap propuesto (por sprints)

### Sprint 1 — "Quick wins" que dan sensación de completitud (todo 🟢, esfuerzo bajo)
Números de página · Marca de agua · Editar metadatos · PDF→Texto · Aplanar · Recortar.
→ +6 herramientas en poco tiempo, todas client-side, sin tocar backend.

### Sprint 2 — Seguridad (refuerza la marca 🔒)
Proteger/quitar contraseña (qpdf-wasm, cliente) · Redactar · Firmar (firma dibujada) · Sanitizar.
→ Diferenciación real frente a iLovePDF en privacidad.

### Sprint 3 — IA (refuerza la tesis "potencia de la IA" para LinkedIn ✨)
Resumir PDF · Traducir PDF · Comparar PDF · Chatear con el PDF.
→ Aprovecha Gemini ya integrado; gran material para el post.

### Sprint 4 — Flagship (alto esfuerzo, alto impacto)
Editor PDF (anotar/texto/imágenes/dibujo) · OCR (tesseract.js) · Formularios (rellenar + diseñar).
→ Las funciones "wow" que ponen a DocLab al nivel de un producto serio.

### Más adelante / opcional
Comprimir PRO (Ghostscript) · PDF→Word/Excel · PDF/A · N-up/Cuadernillo · Reparar · Firma certificada.
