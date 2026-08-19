#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scheduler_root="${repo_root}/services/scheduler"
if [[ ! -x "${scheduler_root}/.venv/bin/mypy" ]]; then
  "${repo_root}/tools/scripts/scheduler-sync.sh" --frozen
fi
cd "${scheduler_root}"
"${scheduler_root}/.venv/bin/mypy" --config-file pyproject.toml src tests
