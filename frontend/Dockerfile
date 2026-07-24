# ── Build estático ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Servir con Nginx endurecido ────────────────────────────────────────────────
FROM nginx:1.27-alpine
# Config propia (CSP, reverse-proxy /api, SPA fallback) en lugar de la default.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/doclab.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
