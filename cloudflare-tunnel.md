# Guía de Configuración: Túnel de Cloudflare Dedicado

Esta guía explica paso a paso cómo crear y configurar un túnel de Cloudflare dedicado para este proyecto de forma paralela al de tu ERP, permitiendo que cualquier persona acceda a la aplicación web a través de internet sin colisionar con tus servicios existentes.

---

## 1. Crear el Nuevo Túnel

Dado que ya tienes `cloudflared` instalado y autenticado (certificado en `~/.cloudflared/cert.pem`), puedes crear un nuevo túnel para este clon de ILovePDF ejecutando el siguiente comando en la terminal:

```bash
cloudflared tunnel create pdf-saas-clon
```

Este comando creará el túnel y generará un archivo de credenciales JSON en `~/.cloudflared/<ID_DEL_TUNEL>.json`. Copia el ID del túnel generado.

---

## 2. Crear el Archivo de Configuración (`config.yml`)

Crea un archivo llamado `config.yml` (puedes guardarlo en `~/.cloudflared/pdf-config.yml`). Este archivo define cómo enrutar el tráfico externo.

### Producción (recomendado) — un solo servicio: Nginx

En producción se levanta el stack `docker-compose.prod.yml`, donde **Nginx** sirve la SPA y hace de reverse-proxy de `/api` hacia el backend. Backend y Gotenberg quedan en la red interna de Docker, sin puertos publicados. El túnel solo necesita apuntar a Nginx:

```yaml
# ~/.cloudflared/pdf-config.yml
tunnel: <ID_DEL_TUNEL>
credentials-file: /Users/AlejandroAF1/.cloudflared/<ID_DEL_TUNEL>.json

ingress:
  # Único servicio expuesto: Nginx (sirve SPA + /api internamente)
  - hostname: pdf.tudominio.com
    service: http://localhost:8088

  # Regla obligatoria por defecto
  - service: http_status:404
```

> [!IMPORTANT]
> Con este modelo, la **única** superficie expuesta a internet es Nginx. El backend (4000) y Gotenberg (3000) **no** son accesibles desde el host ni desde el túnel. Es la configuración más segura y la indicada para algo público ligado a tu marca.

### Desarrollo — dos servicios (Vite + backend)

Si quieres exponer el entorno de desarrollo (no recomendado para algo público), apunta `/api` al backend y el resto al dev server de Vite:

```yaml
ingress:
  - hostname: pdf.tudominio.com
    path: /api/.*
    service: http://localhost:4000
  - hostname: pdf.tudominio.com
    service: http://localhost:5174
  - service: http_status:404
```

---

## 3. Vincular el Subdominio en Cloudflare DNS

Para asociar tu dominio de Cloudflare con el túnel, ejecuta:

```bash
cloudflared tunnel route dns pdf-saas-clon pdf.tudominio.com
```

*(Reemplaza `pdf.tudominio.com` por el subdominio y dominio real que tengas registrado en tu cuenta de Cloudflare).*

---

## 4. Iniciar el Túnel

Para arrancar el túnel en segundo plano o en una pestaña de terminal independiente, ejecuta:

```bash
cloudflared tunnel --config ~/.cloudflared/pdf-config.yml run pdf-saas-clon
```

Con esto, el túnel estará activo escuchando peticiones en tu dominio público y enrutándolas localmente al **Nginx de producción** (`8088`), sin interferir con tu túnel ERP actual.

---

## 5. Levantar el stack de producción

Antes de activar el túnel, levanta el stack endurecido (define tu dominio para que el backend lo acepte en CORS):

```bash
PUBLIC_ORIGIN=https://pdf.tudominio.com docker compose -f docker-compose.prod.yml up -d --build
```

Comprueba localmente antes de exponer:

```bash
curl -I http://localhost:8088/            # debe traer las cabeceras CSP/HSTS
curl http://localhost:8088/api/health     # {"status":"ok",...}
curl http://localhost:4000/api/health     # debe FALLAR (backend aislado) ✓
```
