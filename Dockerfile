# syntax=docker/dockerfile:1

# ---------------------------------------------------------------
# Stage 1 — build: compila la SPA e produce la cartella dist/
# ---------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Le dipendenze si copiano per prime: finché package.json e package-lock.json
# non cambiano, Docker riusa questa layer e la build resta veloce
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Solo ora entra il codice sorgente
COPY . .
RUN npm run build

# ---------------------------------------------------------------
# Stage 2 — runtime: serve i file statici con nginx
# ---------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Config nginx: SPA fallback, gzip, cache degli asset
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Svuota il default di nginx e mette il nostro build
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# docker/compose usano questo per dire se il container è davvero vivo
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
