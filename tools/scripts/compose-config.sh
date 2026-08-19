#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  node "${repo_root}/tools/scripts/env-init.mjs"
fi

compose=(docker compose --env-file "${env_file}" -f "${repo_root}/infra/compose/compose.yaml")

"${compose[@]}" config --quiet
"${compose[@]}" config --format json | node "${repo_root}/tools/scripts/verify-compose-networking.mjs"
echo "Compose configuration is valid (${env_file##*/})."
