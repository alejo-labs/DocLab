<div align="center">

<img src="frontend/public/og-image.png" alt="DocLab, herramientas de PDF que no salen de tu navegador" width="640" />

# DocLab

**Herramientas de PDF que se procesan en tu navegador. Tus archivos nunca salen de tu dispositivo.**

[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-0a8c81)](LICENSE)
![100% en el dispositivo](https://img.shields.io/badge/Procesamiento-100%25%20en%20el%20dispositivo-0a8c81)
![React 19](https://img.shields.io/badge/React-19-14161b)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-14161b)
![Sin vulnerabilidades](https://img.shields.io/badge/npm%20audit-sin%20vulnerabilidades-0a8c81)

</div>

---

## Qué es DocLab

DocLab es una suite de herramientas de PDF con una diferencia de fondo. Casi todo lo que otras webs hacen en sus
servidores, DocLab lo hace dentro de tu navegador con WebAssembly.

Unir, dividir, comprimir, cifrar, editar, reconocer texto (OCR) o convertir. El documento se abre en memoria, se
procesa en tu equipo y se descarga. No hay subida, no hay cuentas y no hay retención. La privacidad no es una
promesa de la letra pequeña, es la arquitectura.

> 🔒 Puedes comprobarlo. Abre la pestaña «Network» del navegador mientras procesas un archivo y verás que no se
> envía nada. Muchas herramientas funcionan incluso sin conexión.

## Funciones

- **Organizar**. Unir, dividir, reordenar, rotar, N-up (varias páginas por hoja) y numerar.
- **Optimizar**. Comprimir con recompresión inteligente de imágenes y pasar imágenes a PDF y de vuelta.
- **Editar**. Editor visual, marcas de agua y formularios (crear, rellenar, firmar).
- **Seguridad**. Proteger y desbloquear con contraseña (AES-256), censurar de verdad, sanear (quitar JavaScript, adjuntos y metadatos) y comparar versiones.
- **Convertir e IA**. OCR para hacer buscables los escaneados, PDF a Word, y un buscador con IA que sugiere la herramienta adecuada.

## Privacidad y seguridad

- Procesamiento local por defecto con WebAssembly (pdf-lib, pdf.js, qpdf, tesseract.js), todo autoalojado, sin CDNs de terceros.
- La única función que usa red es la búsqueda con IA, a la que solo viaja tu frase de búsqueda y nunca un archivo.
- Content-Security-Policy estricta, cabeceras de seguridad y cifrado en un Web Worker.
- Sin dependencias vulnerables (`npm audit` en verde), solo licencias permisivas (MIT, Apache, ISC), con CI y Dependabot.
- Sin `dangerouslySetInnerHTML` en toda la app, TypeScript estricto, `oxlint` a cero avisos y 51 tests de lógica pura.

## Tecnología

| Capa | Stack |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Motores PDF | pdf-lib, pdf.js, qpdf-wasm (AES-256), tesseract.js (OCR), fflate, docx, pptxgenjs |
| Backend mínimo | Express, zod, helmet, rate-limit. Solo el proxy de la búsqueda con IA |
| Infra | Docker, Nginx (CSP y HSTS), despliegue tras túnel |

## Un proyecto de demostración

DocLab es una pieza de demostración desarrollada con asistencia de IA (Claude) de principio a fin. Arquitectura,
motores en WebAssembly, diseño, accesibilidad, tests, seguridad y documentación. Es un ejemplo de hasta dónde
puede llegar hoy el desarrollo asistido por IA manteniendo criterios reales de calidad, privacidad y seguridad.

## Estructura

```
frontend/   SPA de React con las herramientas, los motores de PDF (lib/pdf), las páginas y la UI
backend/    API mínima en Express (solo el proxy de búsqueda con IA)
```

## Desarrollo local

Necesitas Node 22 o superior. Cada parte es independiente.

```bash
# Frontend (la app y todas las herramientas)
cd frontend && npm install && npm run dev

# Backend (opcional, solo habilita la búsqueda con IA; requiere una clave de Gemini)
cd backend && npm install && npm run dev
```

Scripts útiles. En frontend, `npm run build`, `npm run lint` y `npm test`. En backend, `npm run typecheck` y `npm test`.

## Licencia

[MIT](LICENSE) © 2026. Código abierto. Las librerías de terceros conservan sus respectivas licencias.
