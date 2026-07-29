# Despliegue de DocLab (nativo, con PM2 y Cloudflare)

Esta es la forma recomendada para un servidor propio (por ejemplo un Mac Mini que ya corre
otras apps con PM2). El backend Node sirve la SPA ya compilada y la API en un único puerto,
PM2 lo mantiene vivo y Cloudflare lo publica por un túnel. Hay también una alternativa con
Docker en la raíz del repo (`docker-compose.prod.yml`), pero este método no necesita Docker.

## Cómo funciona

```
Navegador ─(HTTPS)─> Cloudflare ─(túnel)─> localhost:4000  (backend Node + PM2)
                                             ├─ sirve la SPA compilada (frontend/dist)
                                             └─ /api  → salud + buscador con IA (opcional)
```

Todo el procesamiento de PDF ocurre en el navegador del visitante, así que el servidor
apenas trabaja. El backend solo entrega archivos estáticos y, si la activas, atiende la
búsqueda con IA. Las cabeceras de seguridad y la CSP (las mismas que ponía Nginx) viajan
desde el propio backend con `helmet`.

## Requisitos

- Node 22 o superior.
- PM2 global (`npm install -g pm2`). Ya lo usas para el ERP.
- `cloudflared` instalado y con tu cuenta de Cloudflare conectada.

## Puesta en marcha (una sola vez)

1. **Instala dependencias** (el lanzador lo hace solo la primera vez, o a mano):
   ```bash
   cd frontend && npm install && cd ../backend && npm install && cd ..
   ```

2. **Configura el backend**. Crea `backend/.env` (no se sube al repo):
   ```bash
   cp backend/.env.example backend/.env
   ```
   y ajusta, como mínimo:
   ```
   CORS_ORIGINS=https://pdf.tudominio.com     # tu dominio real (importante)
   GEMINI_API_KEY=                            # opcional, para el buscador con IA
   ```

3. **Crea un túnel dedicado** para DocLab (no toca el del ERP):
   ```bash
   cloudflared tunnel login              # si no lo has hecho ya
   cloudflared tunnel create doclab      # crea ~/.cloudflared/UUID.json (anota el UUID)
   cloudflared tunnel route dns doclab pdf.tudominio.com
   ```
   Luego copia la plantilla y rellena tu usuario, el UUID y el dominio:
   ```bash
   cp deploy/cloudflared.example.yml deploy/cloudflared.yml
   ```

## Arrancar y reiniciar

Doble clic en `deploy/doclab.command` (o `bash deploy/doclab.command`). Reconstruye el
frontend y el backend, (re)arranca DocLab con PM2 y abre el túnel. Para reiniciar por
cualquier motivo, vuelve a ejecutarlo.

## Gestión con PM2

```bash
pm2 status            # ver DocLab (y tu ERP) a la vez
pm2 logs doclab       # ver logs en vivo
pm2 restart doclab    # reiniciar solo la app
pm2 stop doclab       # parar
```

Para que arranque solo al encender el Mac (como un servidor de verdad):
```bash
pm2 save
pm2 startup           # sigue las instrucciones que imprime
```
El túnel puede dejarse como servicio de `cloudflared` para que también arranque solo.

## Convivencia con el ERP

- DocLab usa el puerto **4000**; tu ERP usa el **3001**. No chocan.
- El **túnel dedicado** evita reiniciar el túnel del ERP al desplegar DocLab.
- PM2 gestiona ambas apps por separado; parar o reiniciar DocLab no afecta al ERP.
- La carga de servidor que añade DocLab es mínima (estáticos + proxy de IA ocasional).

## Notas

- Si cambias el puerto, ajústalo en `deploy/ecosystem.config.cjs` y en `deploy/cloudflared.yml`.
- `CORS_ORIGINS` debe incluir tu dominio público, o la API rechazará las peticiones.
