# Clon de ILovePDF - Proyecto Demostrativo SaaS (Local-First & Self-Hosted)

Este proyecto tiene como objetivo demostrar la viabilidad y simplicidad de replicar herramientas SaaS populares de procesamiento de PDF (como ILovePDF) priorizando la privacidad y el procesamiento local en el navegador, delegando únicamente tareas de conversión de Office y OCR a servicios autoalojados en Docker.

---

## 🛠️ Arquitectura y Asignación de Puertos (Desarrollo Paralelo)

Para poder ejecutar este proyecto en tu Mac Mini M4 de forma simultánea a tu ERP existente (que ocupa los puertos `5173` y `3001`), se han asignado los siguientes puertos dedicados para este entorno:

*   **Frontend (SPA React):** `http://localhost:5174` (Puerto `5174`)
*   **Backend API (Express):** `http://localhost:4000` (Puerto `4000`)
*   **Gotenberg Service (Docker):** `http://localhost:8081` (Puerto `8081`)

---

## 🚀 Guía de Inicio Rápido

### Requisitos Previos

1.  Tener **Docker Desktop** abierto y corriendo en macOS. Puedes iniciarlo desde tu terminal con:
    ```bash
    open -a Docker
    ```

### Paso 1: Iniciar el Microservicio Gotenberg (Conversión de Office)

Desde la raíz del proyecto, levanta el contenedor de Docker para Gotenberg:

```bash
docker compose up -d
```

Puedes verificar que responde correctamente accediendo a su prueba de salud en tu navegador: `http://localhost:8081/health`

### Paso 2: Levantar el Backend API

El backend gestiona llamadas que requieren procesamiento del servidor (conversión a través de Gotenberg y en el futuro, OCR).

1.  Entra en la carpeta del backend:
    ```bash
    cd backend
    ```
2.  Instala las dependencias (si no lo has hecho ya):
    ```bash
    npm install
    ```
3.  Arranca el servidor en modo desarrollo:
    ```bash
    npm run dev
    ```

El servidor estará escuchando en `http://localhost:4000`. Puedes comprobar que está conectado con Docker/Gotenberg entrando en: `http://localhost:4000/api/gotenberg-health`

### Paso 3: Levantar el Frontend (React + Vite)

El frontend realiza el 100% de la manipulación estándar de PDF (unir, dividir, rotar, etc.) de forma local en el navegador utilizando `pdf-lib` y `pdf.js`.

1.  Entra en la carpeta del frontend:
    ```bash
    cd ../frontend
    ```
2.  Instala las dependencias (si no lo has hecho ya):
    ```bash
    npm install
    ```
3.  Arranca la aplicación:
    ```bash
    npm run dev
    ```

El frontend se abrirá en `http://localhost:5174` y tiene configurado un proxy transparente que redirige automáticamente todas las peticiones a `/api` hacia el backend en el puerto `4000`.

---

## ☁️ Acceso Externo (Túnel de Cloudflare)

Para publicar el proyecto en internet de forma que cualquier persona pueda probarlo desde fuera, consulta la guía paso a paso en [cloudflare-tunnel.md](file:///Users/AlejandroAF1/Desktop/PDF%20Proyect/cloudflare-tunnel.md) en la raíz del proyecto.
