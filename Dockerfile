# Dafthunk monorepo 开发镜像
#
# 默认版本与 package.json 一致：Node 20.19 + pnpm 10.3
# 构建时可覆盖：
#   docker build --build-arg NODE_VERSION=22.12.0 --build-arg PNPM_VERSION=10.3.0 .

ARG NODE_VERSION=20.19.0
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
  && corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
  && mkdir -p "${PNPM_STORE_DIR}"

WORKDIR /app

# --- 本地开发（默认目标）---
FROM base AS dev

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3100 3101 3102

ENTRYPOINT ["entrypoint.sh"]
CMD ["pnpm", "dev:docker"]

# --- CI 构建 ---
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile \
  && pnpm build
