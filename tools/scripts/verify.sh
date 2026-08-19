#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repo_root}"

pnpm scheduler:sync --frozen
pnpm toolchain:check
pnpm env:check
pnpm compose:config
pnpm import:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm contracts:check
pnpm test:unit
pnpm test:mobile
pnpm build

stack_started=false
cleanup() {
  if [[ "${stack_started}" == true ]]; then pnpm stack:down; fi
}
trap cleanup EXIT

stack_started=true
pnpm stack:up
pnpm db:migrate:verify
pnpm db:seed:verify
pnpm test:integration
pnpm test:tenancy
pnpm test:authz
pnpm test:e2e
pnpm test:a11y
pnpm db:restore:verify
pnpm security:dependencies
pnpm security:containers
pnpm stack:smoke
pnpm stack:down
stack_started=false

echo "All Milestone 0/1 verification commands passed."
