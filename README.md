# DocLab — Instrumentos de PDF local-first

DocLab es un clon **funcional** de iLovePDF construido sobre un principio: **soberanía del dato**. El
procesamiento estándar de PDF (unir, dividir, organizar, comprimir, imágenes↔PDF) ocurre **100% en el
navegador** mediante `pdf-lib` y `pdf.js` — tus archivos confidenciales no salen de tu dispositivo. Solo la
conversión de Office (Word/Excel/PowerPoint → PDF) se delega a un microservicio Docker (Gotenberg) **efímero
y sin retención**.

Sin cuentas. Sin base de datos. Cero retención.

---

## 🏗️ Arquitectura y puertos (desarrollo en paralelo al ERP)

Para convivir con el ERP existente (puertos `5173` / `3001`), DocLab usa puertos dedicados:

| Servicio                | URL                       | Puerto |
| ----------------------- | ------------------------- | ------ |
| Frontend (React + Vite) | `http://localhost:5174`   | `5174` |
| Backend API (Express/TS)| `http://localhost:4000`   | `4000` |
| Gotenberg (Docker)      | `http://localhost:8081`   | `8081` (solo `127.0.0.1`) |

```
Navegador  ──(pdf-lib / pdf.js, 0 bytes suben)──>  procesa localmente
   │
   └─ /api/convert/office ──> Backend Express (TS, endurecido) ──> Gotenberg (interno, efímero)
```

### Seguridad incorporada
- **Backend en TypeScript** con validación de entorno (`zod`).
- `helmet` (CSP), `express-rate-limit`, **CORS por allowlist**, `x-powered-by` deshabilitado, timeouts.
- Subida **en memoria** (`multer.memoryStorage`) — nunca se escribe a disco. Límite de tamaño configurable.
- Validación de **magic bytes** (no se confía en la extensión ni el MIME declarado).
- Saneado de nombres de archivo (anti header-injection / path traversal).
- Gotenberg **ligado a `127.0.0.1`**, rutas de Chromium deshabilitadas, contenedor `read_only` con `tmpfs`,
  `no-new-privileges` y `cap_drop: ALL`. Nunca se expone al túnel.
- CI (typecheck · test · build · `npm audit`) + Dependabot.

---

## 🚀 Inicio rápido

**Requisito:** Docker Desktop abierto (`open -a Docker`).

```bash
# 1) Servicio de conversión de Office
docker compose up -d                 # Gotenberg en 127.0.0.1:8081

# 2) Backend
cd backend && cp .env.example .env   # ajusta valores si hace falta
npm install && npm run dev           # http://localhost:4000

# 3) Frontend
cd ../frontend
npm install && npm run dev           # http://localhost:5174
```

Comprobaciones: `http://localhost:4000/api/health` y `http://localhost:4000/api/gotenberg-health`.

### Scripts útiles
- Backend: `npm run dev` · `npm run typecheck` · `npm test` · `npm run build`
- Frontend: `npm run dev` · `npm run lint` · `npm run build`

---

## 📦 Producción (stack endurecido)

`docker-compose.prod.yml` levanta tres servicios en una red interna de Docker:

```
Túnel Cloudflare ──> Nginx :8088 ──┬── sirve la SPA (build estático + CSP/HSTS)
  (único expuesto)                 └── reverse-proxy /api ──> backend ──> gotenberg
                                                            (sin puertos publicados)
```

```bash
PUBLIC_ORIGIN=https://pdf.tudominio.com docker compose -f docker-compose.prod.yml up -d --build
```

- **Única superficie expuesta: Nginx.** El backend (4000) y Gotenberg (3000) solo existen en la red interna.
- Nginx añade CSP (afinada para el worker de pdf.js), HSTS, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`.
- Contenedores `read_only`, `cap_drop: ALL`, `no-new-privileges`, con límites de memoria.

## ☁️ Acceso externo (túnel de Cloudflare)

Guía dedicada en [cloudflare-tunnel.md](cloudflare-tunnel.md). En producción el túnel apunta a un **único
servicio (Nginx, 8088)**; el backend y Gotenberg nunca se exponen.
