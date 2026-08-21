# Node runtime image hardening

## Purpose and user outcome

Produce smaller, non-root runtime images for the browser beta's Next.js web, NestJS API, and NestJS
worker services. Deployed images contain compiled application artifacts and production dependencies,
not the monorepo source tree, tests, TypeScript compiler, or test runner. The API image continues to
support the existing one-shot Prisma migration command used by local Compose.

## Scope

### Included

- Convert `infra/docker/node-service.Dockerfile` to separate build, packaging, and runtime stages.
- Package Next.js through its existing standalone output.
- Package API and worker through production-only `pnpm deploy` artifacts.
- Keep the exact `pnpm --filter @league/database db:migrate` contract in the API image with only the
  database schema, migrations, Prisma configuration, and pruned migration dependencies.
- Run all three application services as the unprivileged `node` user.
- Add a focused repository/image verifier for build-stage separation, runtime identity, artifact
  allowlisting, and migration-command compatibility.

### Excluded

- Compose, gateway, Python scheduler, third-party image, dependency-manifest, lockfile, hosted-overlay,
  read-only-filesystem, resource-limit, TLS, secrets, and production infrastructure changes.
- Changes to application behavior, public UI, database schema, or running local services.
- A claim that all image vulnerabilities are resolved before fresh scans of rebuilt images pass.

## Relevant requirements

- **OPS-003 MUST** — secrets and sensitive fields do not enter images or logs.
- **OPS-007 MUST** — this image work supports private application services behind the reverse proxy;
  it does not expose a port or create a deployment.
- **OPS-008 MUST** — only repository code and synthetic build settings enter the build.
- **OPS-010 MUST** — existing service health commands must continue to run in the runtime images.
- **OPS-013 MUST** — no production deployment or infrastructure mutation is authorized.
- `docs/ARCHITECTURE_AND_DATA.md` requires non-root containers and supported, pinned runtime
  versions; `docs/assurance/THREAT_MODEL.md` requires exact image inputs and scan evidence.

## Current-state findings

- `infra/docker/node-service.Dockerfile` currently has one stage. Its final filesystem contains the
  full copied `apps/` and `packages/` trees, all build dependencies, pnpm store, TypeScript sources,
  and test files.
- The currently built local images are approximately 1.3 GB for web, 1.65 GB for API, and 712 MB for
  worker. Size is supporting evidence only; vulnerability status requires a fresh scanner result.
- `apps/web/next.config.ts` already enables `output: 'standalone'`.
- API and worker start from compiled JavaScript in `dist/` and can use production-only deployed
  dependency graphs.
- `infra/compose/compose.yaml` intentionally reuses the API image for the `migrate` service and
  overrides its command with `pnpm --filter @league/database db:migrate`. A generic runtime image
  that removes pnpm or the Prisma schema/migrations from API would break clean database startup.
- The shared stack is running. Validation builds must use distinct tags and must not replace,
  restart, or stop those containers.

## Proposed design

Use the pinned Node Debian slim image for both build and runtime stages. The build stage installs the
frozen workspace graph and compiles only the selected workspace and its dependencies. A packaging
stage constructs an allowlisted `/app/.runtime` tree:

- Web receives `.next/standalone` plus `.next/static` and any `public/` directory.
- API and worker receive `pnpm deploy --prod` output, after removing only repository-owned source,
  tests, TypeScript declarations/maps, build logs, and TypeScript configuration from that artifact.
- API additionally receives a minimal `packages/database` deployment. Its dev dependency set is
  discarded, Prisma CLI is retained as an explicit runtime migration dependency, and only the Prisma
  configuration/schema/migrations plus package metadata remain outside compiled/runtime packages.

The final stage installs only CA certificates and OpenSSL compatibility packages, copies that
allowlisted tree with `node:node` ownership, strips npm from every runtime, and keeps Corepack/pnpm
only in the API image because the existing migration contract requires it. A workspace-validated
shell dispatch executes the exact compiled entry point. The final stage switches permanently to
`USER node`.

The verifier has two modes. Static mode rejects regressions in stage separation, non-root setup,
and direct compiled entry points. Image mode inspects a distinct test tag, confirms `node` identity,
checks that repository source/tests and known dev-tool binaries are absent, confirms the expected
compiled entry point, and checks the API migration command with `prisma migrate status` against a
deliberately unreachable synthetic database URL. The latter must reach Prisma and fail on connection,
not fail because pnpm, the workspace, schema, or migration files are absent.

## Milestones

- [x] Add the focused ExecPlan and static/runtime verification contract.
- [x] Convert the shared Node Dockerfile to build/package/runtime stages.
- [x] Build web, API, and worker under distinct hardening tags without changing the Compose images.
- [x] Pass static validation and per-image runtime-content/identity checks.
- [ ] Prove web/API/worker entry-point startup reaches the expected dependency boundary and prove the
      API migration command resolves its packaged Prisma assets.
- [ ] Run fresh vulnerability scans when the scanner/cache is available; report exact findings and
      leave the broader release gate open for any remaining image or third-party findings.

## Verification and acceptance

Run from the repository root:

```bash
node tools/scripts/verify-node-runtime-image.mjs
docker build --file infra/docker/node-service.Dockerfile --build-arg WORKSPACE=@league/web --tag league-app/web:runtime-hardening-check .
docker build --file infra/docker/node-service.Dockerfile --build-arg WORKSPACE=@league/api --tag league-app/api:runtime-hardening-check .
docker build --file infra/docker/node-service.Dockerfile --build-arg WORKSPACE=@league/worker --tag league-app/worker:runtime-hardening-check .
node tools/scripts/verify-node-runtime-image.mjs --image league-app/web:runtime-hardening-check --workspace @league/web
node tools/scripts/verify-node-runtime-image.mjs --image league-app/api:runtime-hardening-check --workspace @league/api
node tools/scripts/verify-node-runtime-image.mjs --image league-app/worker:runtime-hardening-check --workspace @league/worker
pnpm exec prettier --check --ignore-unknown infra/docker/node-service.Dockerfile tools/scripts/verify-node-runtime-image.mjs execplans/2026-08-21-node-runtime-image-hardening.md
git diff --check -- infra/docker/node-service.Dockerfile tools/scripts/verify-node-runtime-image.mjs execplans/2026-08-21-node-runtime-image-hardening.md
```

Acceptance requires:

- all images have `Config.User=node` and the expected `WORKSPACE` value;
- web has standalone server/static assets; API and worker have their compiled entry points;
- app source, repository tests, `.turbo`, TypeScript configs, TypeScript compiler, Vitest, and tsx are
  absent from final images;
- pnpm is absent from web and worker, while API can run the exact migration command far enough to
  attempt a database connection using its packaged schema and migrations;
- the existing running Compose containers and their image tags/IDs remain unchanged;
- fresh scans are recorded separately before claiming the runtime vulnerability gate is closed.

## Migration, rollback, and data compatibility

There is no database or persisted-data change. Rollback is a one-file Dockerfile revert and rebuild
of the previous application image. Distinct validation tags make this increment non-disruptive. The
API's existing migration command and forward-only migration files are preserved byte-for-byte in the
runtime artifact.

## Security and privacy review

- `.dockerignore` already excludes Git metadata, environment files, secrets/key extensions, local
  dependency/build caches, source documents, exports, backups, and data. No ignore change is needed.
- Final stages copy only packaging-stage output; they never copy the build workspace or pnpm store.
- All runtime files are owned by `node`; services execute as `node`; no setuid or privilege escalation
  behavior is added.
- Package-manager capability remains only where the existing API migration job requires it. The
  planned longer-term improvement is a dedicated migrator image, outside this slice.
- No secret, `.env`, real record, source document, network exposure, or production resource is used.
- Multi-stage pruning reduces attack surface but is not evidence of zero vulnerabilities. Trivy or an
  equivalent fresh scanner remains authoritative for the high/critical gate.

## Decisions made

- Preserve the existing shared API/migrator image contract instead of changing Compose ownership or
  introducing a fourth application image in this bounded slice.
- Use Next.js standalone output for web and `pnpm deploy --prod` for API/worker rather than copying the
  complete workspace into final stages.
- Keep the pinned Node patch/digest and exact Debian package versions in this change. Base-image
  refresh and vulnerability closure require separate fresh scan evidence, not an unreviewed tag move.
- Remove npm from all final images and Corepack/pnpm from web/worker; retain pnpm in API only.

## Discoveries and risks

- The Prisma migration compatibility requirement makes API necessarily larger than a pure compiled
  service runtime. A dedicated migrator target/image would allow further reduction later.
- `pnpm deploy --legacy` copies repository-owned source alongside runtime output even with `--prod`;
  packaging must remove those exact owned paths without deleting similarly named runtime directories
  from third-party packages.
- Image builds are resource-intensive and share a host with a live synthetic stack. They must use
  distinct tags and bounded/sequential builds if memory pressure appears.
- Container scans may still find Debian, Node, Prisma-engine, or third-party package vulnerabilities.
  This plan must not convert surface reduction into a release-readiness claim.

## Progress log

- 2026-08-21 UTC — Read repository/runbook/status, requirements, architecture, security operations,
  threat model, data inventory, current Dockerfile/Compose contracts, workspace scripts, and Next
  standalone configuration. Confirmed current image sizes and the API migration compatibility
  constraint without changing the running stack.
- 2026-08-21 UTC — Implemented three-stage packaging and a focused verifier. Built distinct
  `runtime-hardening-check` tags and passed static plus web/API/worker runtime-content, non-root,
  compiled-entry, and API migration-to-database-boundary probes. The currently running Compose image
  IDs were not replaced or restarted.
- 2026-08-21 UTC — Validation-tag sizes are web 403 MB, API 1.55 GB, and worker 845 MB versus the
  pre-change local images at approximately 1.3 GB, 1.65 GB, and 712 MB. The final images exclude the
  repository source/tests and checked dev-tool executables, but API dependency duplication and the
  worker size regression mean the size goal is only partially met. A dedicated migrator image,
  further production dependency packing, entry-point startup probes, and fresh vulnerability scans
  remain required; this checkpoint does not close the runtime security gate.
