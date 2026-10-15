# API do Coado. Contexto de build = raiz do monorepo:
#   docker build -f apps/api/Dockerfile .

# ---------- dependências (lockfile único do monorepo) ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @coado/api --include-workspace-root=false

# ---------- build (esbuild empacota src + @coado/shared) ----------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @coado/api

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @coado/api --include-workspace-root=false \
    && npm cache clean --force \
    && mkdir -p /data/uploads && chown -R node:node /data
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations

WORKDIR /app/apps/api
USER node
VOLUME /data/uploads
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# migrações: rode `node dist/migrate.js` (o compose faz isso num serviço próprio antes da api subir)
CMD ["node", "dist/server.js"]
