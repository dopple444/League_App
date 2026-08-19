#!/usr/bin/env bash
set -euo pipefail

gateway_url="${GATEWAY_URL:-http://127.0.0.1:8080}"

check_url() {
  local label="$1"
  local url="$2"
  curl --fail --silent --show-error --retry 8 --retry-delay 2 --retry-connrefused "${url}" >/dev/null
  echo "PASS ${label}: ${url}"
}

check_url "gateway" "${gateway_url}/healthz"
check_url "web" "${gateway_url}/"
check_url "api" "${gateway_url}/api/healthz"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  echo "Local .env is missing. Run pnpm env:init before smoke testing." >&2
  exit 1
fi
docker compose --env-file "${env_file}" -f "${repo_root}/infra/compose/compose.yaml" exec -T worker \
  node -e "fetch('http://127.0.0.1:3002/healthz').then((response)=>{if(!response.ok)process.exit(1)})"
echo "PASS worker: private health endpoint"
docker compose --env-file "${env_file}" -f "${repo_root}/infra/compose/compose.yaml" exec -T scheduler \
  python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"
echo "PASS scheduler: private health endpoint"
