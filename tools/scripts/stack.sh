#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="${repo_root}/infra/compose/compose.yaml"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  node "${repo_root}/tools/scripts/env-init.mjs"
fi

action="${1:-}"
case "${action}" in
  up)
    docker compose --env-file "${env_file}" -f "${compose_file}" up --detach --build --wait
    # NGINX resolves Compose service names when it starts. Recreate it after rebuilt
    # application containers receive new addresses so a warm rebuild cannot retain
    # stale upstream IPs and return 502 responses.
    docker compose --env-file "${env_file}" -f "${compose_file}" up \
      --detach --no-deps --force-recreate --wait gateway
    ;;
  down)
    docker compose --env-file "${env_file}" -f "${compose_file}" down --remove-orphans
    ;;
  *)
    echo "Usage: $0 <up|down>" >&2
    exit 2
    ;;
esac
