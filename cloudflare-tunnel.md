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

Crea un archivo llamado `config.yml` (puedes guardarlo en `~/.cloudflared/pdf-config.yml` o en la propia raíz del proyecto). Este archivo definirá cómo enrutar el tráfico externo a tus puertos locales:

```yaml
# ~/.cloudflared/pdf-config.yml

tunnel: <ID_DEL_TUNEL>
credentials-file: /Users/AlejandroAF1/.cloudflared/<ID_DEL_TUNEL>.json

ingress:
  # 1. Enrutar las llamadas a la API al Backend (Puerto 4000)
  - hostname: pdf.tudominio.com
    path: /api/.*
    service: http://localhost:4000

  # 2. Enrutar el resto del tráfico web al Frontend de Vite (Puerto 5174)
  - hostname: pdf.tudominio.com
    service: http://localhost:5174

  # 3. Regla obligatoria por defecto de Cloudflare para capturar errores de coincidencia
  - service: http_status:404
```

> [!NOTE]
> Al configurar la regla `/api/.*` apuntando al backend (puerto 4000) y la raíz al frontend (puerto 5174) bajo el mismo hostname `pdf.tudominio.com`, evitamos completamente los problemas de CORS y simplificamos el acceso a un solo subdominio certificado.

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

Con esto, el túnel estará activo escuchando peticiones en tu dominio público y enrutándolas localmente a:
- El frontend en el puerto `5174`.
- El backend en el puerto `4000` (cuando comiencen por `/api/`).
- Todo esto sin interferir con tu túnel ERP actual.
