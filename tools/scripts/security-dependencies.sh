#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scan_failed=false
current_utc_date="$(date -u +%F)"
dependency_audit_report="$(mktemp "${TMPDIR:-/tmp}/league-app-dependency-audit.XXXXXX.json")"
dependency_audit_stderr="$(mktemp "${TMPDIR:-/tmp}/league-app-dependency-audit.XXXXXX.stderr")"

cleanup() {
  rm -f "${dependency_audit_report}" "${dependency_audit_stderr}"
}
trap cleanup EXIT

dependency_audit_exit_code=0
if (
  cd "${repo_root}"
  pnpm audit --prod --audit-level high --json
) >"${dependency_audit_report}" 2>"${dependency_audit_stderr}"; then
  dependency_audit_exit_code=0
else
  dependency_audit_exit_code=$?
fi

cat "${dependency_audit_report}"
if [[ -s "${dependency_audit_stderr}" ]]; then
  cat "${dependency_audit_stderr}" >&2
fi

if ! node "${repo_root}/tools/scripts/check-dependency-audit.mjs" \
  --report "${dependency_audit_report}" \
  --audit-exit-code "${dependency_audit_exit_code}" \
  --current-date "${current_utc_date}" \
  --exception-record "${repo_root}/docs/assurance/SECURITY_EXCEPTIONS.md" \
  --lockfile "${repo_root}/pnpm-lock.yaml" \
  --workspace-config "${repo_root}/pnpm-workspace.yaml"; then
  scan_failed=true
fi

scheduler_python="${repo_root}/services/scheduler/.venv/bin/python"
if [[ ! -x "${scheduler_python}" ]]; then
  "${repo_root}/tools/scripts/scheduler-sync.sh" --frozen
fi
if ! "${scheduler_python}" -m pip check; then
  scan_failed=true
fi
python_requirement_locks=(
  "${repo_root}/services/scheduler/requirements.lock"
  "${repo_root}/services/scheduler/requirements.runtime.lock"
)
for requirement_lock in "${python_requirement_locks[@]}"; do
  if ! "${scheduler_python}" -m pip_audit \
    --requirement "${requirement_lock}" \
    --strict; then
    scan_failed=true
  fi
done

if [[ "${scan_failed}" == true ]]; then
  echo "One or more dependency ecosystems contain reportable vulnerabilities." >&2
  exit 1
fi
