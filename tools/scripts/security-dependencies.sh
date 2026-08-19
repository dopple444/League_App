#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scan_failed=false
if ! pnpm --dir "${repo_root}" audit --prod --audit-level high; then
  scan_failed=true
fi

scheduler_python="${repo_root}/services/scheduler/.venv/bin/python"
if [[ ! -x "${scheduler_python}" ]]; then
  "${repo_root}/tools/scripts/scheduler-sync.sh" --frozen
fi
if ! "${scheduler_python}" -m pip check; then
  scan_failed=true
fi
if ! "${scheduler_python}" -m pip_audit \
  --requirement "${repo_root}/services/scheduler/requirements.lock" \
  --strict; then
  scan_failed=true
fi

if [[ "${scan_failed}" == true ]]; then
  echo "One or more dependency ecosystems contain reportable vulnerabilities." >&2
  exit 1
fi
