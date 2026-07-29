#!/bin/bash
# Lanzador de DocLab (nativo + PM2 + túnel de Cloudflare).
# Doble clic en Finder, o `bash deploy/doclab.command`. Reconstruye y (re)arranca todo.
set -euo pipefail
cd "$(dirname "$0")/.."   # raíz del proyecto

# DEMONIO DE PM2 PROPIO Y AISLADO. Sin esto, DocLab comparte ~/.pm2 con el ERP y, al
# usar versiones de PM2 distintas, cada lanzamiento reinicia el otro (se "mezclan").
# Con un PM2_HOME dedicado, DocLab tiene su propio demonio, independiente del ERP.
export PM2_HOME="$HOME/.pm2-doclab"

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

# Detectar comando PM2 (usar npx pm2 si no está instalado de forma global)
PM2_CMD="pm2"
if ! command -v pm2 &> /dev/null; then
  echo "ℹ️  PM2 no está instalado globalmente. Usando 'npx pm2'..."
  PM2_CMD="npx pm2"
fi

echo "📡 Arrancando/recargando con PM2..."
$PM2_CMD startOrReload deploy/ecosystem.config.cjs --update-env
$PM2_CMD save

echo "---------------------------------------------------------"
echo "✅ DocLab en marcha en http://localhost:4000  (PM2: 'doclab')"
echo "   Logs:   $PM2_CMD logs doclab      Estado: $PM2_CMD status"
echo "---------------------------------------------------------"

CONFIG="deploy/cloudflared.yml"
if [ ! -f "$CONFIG" ] && [ -f "$HOME/.cloudflared/pdf-config.yml" ]; then
  CONFIG="$HOME/.cloudflared/pdf-config.yml"
fi

if [ -f "$CONFIG" ]; then
  echo "🌐 Abriendo túnel de Cloudflare..."
  cloudflared tunnel --config "$CONFIG" run doclab-pdf
else
  echo "ℹ️  Túnel aún sin configurar. Cuando tengas el dominio, crea '$CONFIG'"
  echo "    siguiendo deploy/README.md. La app ya está corriendo en http://localhost:4000."
fi
