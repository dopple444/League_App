#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
if [[ ! -f "${env_file}" ]]; then
  echo "Local .env is missing. Run pnpm env:init before smoke testing." >&2
  exit 1
fi

configured_gateway_port="$(awk -F= '$1 == "GATEWAY_PORT" { value = substr($0, index($0, "=") + 1) } END { print value }' "${env_file}" | tr -d '\r')"
configured_gateway_host="$(awk -F= '$1 == "GATEWAY_HOST" { value = substr($0, index($0, "=") + 1) } END { print value }' "${env_file}" | tr -d '\r')"
gateway_port="${GATEWAY_PORT:-${configured_gateway_port:-8080}}"
gateway_host="${GATEWAY_HOST:-${configured_gateway_host:-127.0.0.1}}"
if [[ ! "${gateway_port}" =~ ^[0-9]+$ ]]; then
  echo "GATEWAY_PORT must be an integer from 1 through 65535." >&2
  exit 1
fi

# Canonicalize the digit string before arithmetic so Bash cannot interpret a
# leading zero as an octal prefix (and reject otherwise valid ports such as 08088).
gateway_port="${gateway_port#"${gateway_port%%[!0]*}"}"
gateway_port="${gateway_port:-0}"
if ((${#gateway_port} > 5)) || ((10#${gateway_port} < 1 || 10#${gateway_port} > 65535)); then
  echo "GATEWAY_PORT must be an integer from 1 through 65535." >&2
  exit 1
fi
gateway_url="${GATEWAY_URL:-http://${gateway_host}:${gateway_port}}"

check_url() {
  local label="$1"
  local url="$2"
  curl --fail --silent --show-error --retry 8 --retry-delay 2 --retry-connrefused "${url}" >/dev/null
  echo "PASS ${label}: ${url}"
}

check_url "gateway" "${gateway_url}/healthz"
check_url "web" "${gateway_url}/"
check_url "api" "${gateway_url}/api/healthz"

docker compose --env-file "${env_file}" -f "${repo_root}/infra/compose/compose.yaml" exec -T worker \
  node -e "fetch('http://127.0.0.1:3002/healthz').then((response)=>{if(!response.ok)process.exit(1)})"
echo "PASS worker: private health endpoint"
docker compose --env-file "${env_file}" -f "${repo_root}/infra/compose/compose.yaml" exec -T scheduler \
  python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"
echo "PASS scheduler: private health endpoint"
