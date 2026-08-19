#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
scheduler_root="${repo_root}/services/scheduler"
frozen=false

for argument in "$@"; do
  case "${argument}" in
    --frozen) frozen=true ;;
    *) echo "Unknown scheduler:sync argument: ${argument}" >&2; exit 2 ;;
  esac
done

python3 "${scheduler_root}/scripts/validate_lock.py"

if [[ "${frozen}" == true && ! -f "${scheduler_root}/requirements.lock" ]]; then
  echo "requirements.lock is required in frozen mode." >&2
  exit 1
fi

uv_binary="$("${repo_root}/tools/scripts/ensure-uv.sh")"
sync_arguments=(sync --project "${scheduler_root}" --all-extras --python 3.14.7)
if [[ "${frozen}" == true ]]; then sync_arguments+=(--frozen); fi
"${uv_binary}" "${sync_arguments[@]}"
echo "Scheduler environment synchronized from uv.lock."
