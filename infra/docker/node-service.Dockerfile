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
RUN case "${WORKSPACE}" in \
      '@league/web'|'@league/api'|'@league/worker') ;; \
      *) echo "Unsupported WORKSPACE: ${WORKSPACE}" >&2; exit 64 ;; \
    esac \
    && pnpm install --frozen-lockfile --filter "${WORKSPACE}..." \
    && pnpm --workspace-concurrency=1 --filter "${WORKSPACE}..." build \
    && pnpm store prune

FROM build AS package

ARG WORKSPACE
USER node
RUN set -eux; \
    mkdir -p /app/.runtime/apps /app/.runtime/packages; \
    case "${WORKSPACE}" in \
      '@league/web') \
        cp -a apps/web/.next/standalone/. /app/.runtime/; \
        for helper_source in node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers; do \
          helper_relative="${helper_source#node_modules/.pnpm/}"; \
          helper_target="/app/.runtime/node_modules/.pnpm/${helper_relative}"; \
          mkdir -p "${helper_target}"; \
          cp -a "${helper_source}/." "${helper_target}/"; \
        done; \
        mkdir -p /app/.runtime/apps/web/.next; \
        cp -a apps/web/.next/static /app/.runtime/apps/web/.next/static; \
        if [ -d apps/web/public ]; then \
          cp -a apps/web/public /app/.runtime/apps/web/public; \
        fi \
        ;; \
      '@league/api'|'@league/worker') \
        app_name="${WORKSPACE#@league/}"; \
        app_root="/app/.runtime/apps/${app_name}"; \
        pnpm --filter "${WORKSPACE}" deploy --prod --legacy "${app_root}"; \
        rm -rf \
          "${app_root}/.turbo" \
          "${app_root}/src" \
          "${app_root}/test" \
          "${app_root}/tsconfig.json" \
          "${app_root}/dist/test"; \
        find "${app_root}/dist" -type f \
          \( -name '*.d.ts' -o -name '*.d.ts.map' -o -name '*.js.map' \) -delete; \
        find "${app_root}/node_modules/.pnpm" \
          -regextype posix-extended \
          -type d \
          -regex '.*/node_modules/@league/[^/]+$' \
          -exec sh -eu -c 'for package_root do \
            rm -rf \
              "${package_root}/.turbo" \
              "${package_root}/src" \
              "${package_root}/test" \
              "${package_root}/scripts" \
              "${package_root}/prisma" \
              "${package_root}/dist/test"; \
          done' sh '{}' +; \
        find "${app_root}/node_modules/.pnpm" -type f \
          -path '*/node_modules/@league/*/dist/*' \
          \( -name '*.d.ts' -o -name '*.d.ts.map' -o -name '*.js.map' \) -delete; \
        find "${app_root}/node_modules/.pnpm" -type f \
          -path '*/node_modules/@league/*/tsconfig*.json' -delete; \
        if [ "${WORKSPACE}" = '@league/api' ]; then \
          cp package.json pnpm-workspace.yaml /app/.runtime/; \
          pnpm --dir packages/database pkg delete devDependencies; \
          pnpm --dir packages/database pkg set dependencies.prisma=7.9.1; \
          pnpm --filter @league/database deploy --prod --legacy \
            /app/.runtime/packages/database; \
          rm -rf \
            /app/.runtime/packages/database/.turbo \
            /app/.runtime/packages/database/dist \
            /app/.runtime/packages/database/scripts \
            /app/.runtime/packages/database/src \
            /app/.runtime/packages/database/test \
            /app/.runtime/packages/database/prisma/seed.ts \
            /app/.runtime/packages/database/tsconfig.json \
            /app/.runtime/packages/database/node_modules/.bin/acorn \
            /app/.runtime/packages/database/node_modules/.bin/tsc \
            /app/.runtime/packages/database/node_modules/.bin/tsserver; \
        fi \
        ;; \
      *) \
        echo "Unsupported WORKSPACE: ${WORKSPACE}" >&2; \
        exit 64 \
        ;; \
    esac

FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS runtime

ARG WORKSPACE
ENV COREPACK_HOME=/opt/corepack \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false \
    WORKSPACE=${WORKSPACE}

RUN case "${WORKSPACE}" in \
      '@league/web'|'@league/api'|'@league/worker') ;; \
      *) echo "Unsupported WORKSPACE: ${WORKSPACE}" >&2; exit 64 ;; \
    esac \
    && apt-get update \
    && apt-get install --yes --no-install-recommends \
      ca-certificates=20250419~deb12u1 \
      openssl=3.0.20-1~deb12u2 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx \
    && if [ "${WORKSPACE}" = '@league/api' ]; then \
      corepack install --global pnpm@11.22.0; \
      corepack enable pnpm --install-directory /usr/local/bin; \
      rm -f /usr/local/bin/pnpx; \
    else \
      rm -rf /usr/local/lib/node_modules/corepack; \
      rm -f /usr/local/bin/corepack; \
    fi

WORKDIR /app
COPY --from=package --chown=node:node /app/.runtime/ ./

USER node
CMD ["sh", "-eu", "-c", "case \"${WORKSPACE}\" in '@league/web') exec node apps/web/server.js ;; '@league/api') exec node apps/api/dist/src/main.js ;; '@league/worker') exec node apps/worker/dist/main.js ;; *) echo \"Unsupported WORKSPACE: ${WORKSPACE}\" >&2; exit 64 ;; esac"]
