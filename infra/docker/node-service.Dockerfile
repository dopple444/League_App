FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS build

ARG WORKSPACE
ENV COREPACK_HOME=/corepack \
    DATABASE_URL=postgresql://build:build@invalid:5432/build \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/home/node/.local/share/pnpm \
    PATH=/home/node/.local/share/pnpm:$PATH

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
      ca-certificates=20250419~deb12u1 \
      openssl=3.0.20-1~deb12u2 \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack install --global pnpm@11.22.0
WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
USER node
RUN pnpm install --frozen-lockfile --filter "${WORKSPACE}..." \
    && pnpm --filter "${WORKSPACE}..." build \
    && pnpm store prune

ENV NODE_ENV=production \
    WORKSPACE=${WORKSPACE}

CMD ["sh", "-c", "pnpm --filter \"${WORKSPACE}\" start"]
