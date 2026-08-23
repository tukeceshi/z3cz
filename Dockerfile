# Dafthunk monorepo 开发镜像
#
# 默认版本与 package.json 一致：Node 22.12 + pnpm 10.3
# 构建时可覆盖：
#   docker build --build-arg NODE_VERSION=22.12.0 --build-arg PNPM_VERSION=10.3.0 .

ARG NODE_VERSION=22.12.0
FROM node:${NODE_VERSION}-bookworm-slim AS base

ARG PNPM_VERSION=10.3.0
ENV PNPM_HOME="/pnpm"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack disable \
  && npm install -g "pnpm@${PNPM_VERSION}" \
  && mkdir -p "${PNPM_STORE_DIR}"

WORKDIR /app

# --- 本地开发（全栈单容器，profile monolith）---
FROM base AS dev

COPY docker/entrypoint-common.sh /usr/local/bin/entrypoint-common.sh
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint.sh \
  && chmod +x /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint.sh

EXPOSE 3101 3102

ENTRYPOINT ["entrypoint.sh"]
CMD ["pnpm", "dev:docker"]

# --- 本地开发（app）---
FROM base AS dev-app

COPY docker/entrypoint-common.sh /usr/local/bin/entrypoint-common.sh
COPY docker/entrypoint-frontend.sh /usr/local/bin/entrypoint-frontend.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint-frontend.sh \
  && chmod +x /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint-frontend.sh

EXPOSE 3101

ENTRYPOINT ["entrypoint-frontend.sh"]
CMD ["pnpm", "--filter", "@dafthunk/app", "dev"]

# --- 本地开发（仅 API）---
FROM base AS dev-api

COPY docker/entrypoint-common.sh /usr/local/bin/entrypoint-common.sh
COPY docker/entrypoint-api.sh /usr/local/bin/entrypoint-api.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint-api.sh \
  && chmod +x /usr/local/bin/entrypoint-common.sh /usr/local/bin/entrypoint-api.sh

EXPOSE 3102

ENTRYPOINT ["entrypoint-api.sh"]
CMD ["pnpm", "--filter", "@dafthunk/api", "dev:docker:api"]

# --- 依赖安装（prod-api / prod-app 共用，避免重复 install）---
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

# --- CI 全量构建 ---
FROM deps AS build

RUN pnpm build

# --- 产品 app 生产静态资源（仅 Vite 构建，复用 deps 层）---
FROM deps AS build-app-prod

ARG VITE_API_HOST=/api
ARG VITE_WEBSITE_URL=http://localhost:3101
ARG VITE_APP_URL=http://localhost:3101
ARG VITE_WS_VIA_PROXY=1

ENV VITE_API_HOST=${VITE_API_HOST}
ENV VITE_WEBSITE_URL=${VITE_WEBSITE_URL}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_WS_VIA_PROXY=${VITE_WS_VIA_PROXY}
# Vite chunk/minify peak >1.5GB (5366+ modules). Cap must exceed peak so
# small hosts can spill to swap instead of V8 OOM at the artificial limit.
# Override: docker build --build-arg NODE_MAX_OLD_SPACE_SIZE=6144 ...
ARG NODE_MAX_OLD_SPACE_SIZE=4096
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}

RUN pnpm --filter '@dafthunk/types' build \
  && pnpm --filter '@dafthunk/app' build:docker-prod

FROM nginx:1.27-alpine AS prod-app

# Default: static-only (Caddy / edge owns /api). Legacy compose may mount app.conf over this.
COPY docker/nginx/app.static.conf /etc/nginx/conf.d/default.conf
COPY --from=build-app-prod /app/apps/app/dist /usr/share/nginx/html

EXPOSE 80

# --- Node API 生产运行（tsx 直跑源码，无需 pnpm build）---
FROM deps AS prod-api

# Sync reads files listed in the manifest (shell/prefetch gz + landing media).
# Copy the full dist — assets/ alone omits /landing/* and breaks production sync.
COPY --from=build-app-prod /app/apps/app/dist /app/data/bootstrap

COPY docker/prod-api-entrypoint.sh /usr/local/bin/prod-api-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/prod-api-entrypoint.sh \
  && chmod +x /usr/local/bin/prod-api-entrypoint.sh

WORKDIR /app/apps/api

ENV HOST=0.0.0.0
ENV PORT=3102
ENV NODE_ENV=production
ENV BOOTSTRAP_ASSETS_DIR=/app/data/bootstrap

EXPOSE 3102

ENTRYPOINT ["prod-api-entrypoint.sh"]
CMD ["pnpm", "exec", "tsx", "--import", "./src/shims/cloudflare-register.mjs", "src/server.ts"]
