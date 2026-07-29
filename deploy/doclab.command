#!/bin/bash
# Lanzador de DocLab (nativo + PM2 + túnel de Cloudflare).
# Doble clic en Finder, o `bash deploy/doclab.command`. Reconstruye y (re)arranca todo.
set -euo pipefail
cd "$(dirname "$0")/.."   # raíz del proyecto

echo "---------------------------------------------------------"
echo "🚀 Arrancando DocLab en tu Mac..."
echo "---------------------------------------------------------"

# Dependencias (solo la primera vez o si faltan).
[ -d frontend/node_modules ] || ( echo "📦 Instalando frontend..."; cd frontend && npm install )
[ -d backend/node_modules ]  || ( echo "📦 Instalando backend...";  cd backend  && npm install )

echo "🏗️  Construyendo frontend (producción)..."
( cd frontend && npm run build )

echo "🏗️  Construyendo backend..."
( cd backend && npm run build )

echo "📡 Arrancando/recargando con PM2..."
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "---------------------------------------------------------"
echo "✅ DocLab en marcha en http://localhost:4000  (PM2: 'doclab')"
echo "   Logs:   pm2 logs doclab      Estado: pm2 status"
echo "---------------------------------------------------------"

CONFIG="deploy/cloudflared.yml"
if [ -f "$CONFIG" ]; then
  echo "🌐 Abriendo túnel de Cloudflare..."
  cloudflared tunnel --config "$CONFIG" run
else
  echo "ℹ️  Túnel aún sin configurar. Cuando tengas el dominio, crea '$CONFIG'"
  echo "    siguiendo deploy/README.md. La app ya está corriendo en http://localhost:4000."
fi
