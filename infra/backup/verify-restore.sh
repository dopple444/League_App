#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${repo_root}/.env"
compose_file="${repo_root}/infra/compose/compose.yaml"
if [[ ! -f "${env_file}" ]]; then
  echo "Local .env is missing. Run pnpm env:init before restore verification." >&2
  exit 1
fi

restore_database="league_restore_verify_$(date -u +%Y%m%d%H%M%S)_$$"
if [[ ! "${restore_database}" =~ ^league_restore_verify_[0-9]{14}_[0-9]+$ ]]; then
  echo "Refusing an invalid temporary restore database name." >&2
  exit 1
fi
temporary_directory="$(mktemp -d)"
dump_file="${temporary_directory}/league.dump"
database_created=false
source_snapshot_id=""
source_snapshot_pid=""
source_snapshot_read_fd=""
source_snapshot_write_fd=""

compose() {
  docker compose --env-file "${env_file}" -f "${compose_file}" "$@"
}

release_source_snapshot() {
  if [[ -z "${source_snapshot_pid}" ]]; then return; fi

  printf '%s\n' 'ROLLBACK;' '\quit' >&"${source_snapshot_write_fd}"
  exec {source_snapshot_write_fd}>&-
  exec {source_snapshot_read_fd}<&-
  wait "${source_snapshot_pid}"
  source_snapshot_id=""
  source_snapshot_pid=""
}

cleanup() {
  release_source_snapshot 2>/dev/null || true
  if [[ "${database_created}" == true ]]; then
    compose exec -T postgres sh -eu -c \
      'dropdb --if-exists --force --username="$POSTGRES_USER" "$1"' -- "${restore_database}" >/dev/null
  fi
  if [[ -f "${dump_file}" ]]; then rm -f -- "${dump_file}"; fi
  rmdir "${temporary_directory}" 2>/dev/null || true
}
trap cleanup EXIT

coproc SOURCE_SNAPSHOT {
  compose exec -T postgres sh -eu -c \
    'exec psql --no-psqlrc --set=ON_ERROR_STOP=1 --quiet --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
}
source_snapshot_pid="${SOURCE_SNAPSHOT_PID}"
source_snapshot_read_fd="${SOURCE_SNAPSHOT[0]}"
source_snapshot_write_fd="${SOURCE_SNAPSHOT[1]}"
printf '%s\n' \
  'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;' \
  'SELECT pg_export_snapshot();' \
  >&"${source_snapshot_write_fd}"
IFS= read -r source_snapshot_id <&"${source_snapshot_read_fd}"
if [[ ! "${source_snapshot_id}" =~ ^[[:xdigit:]]+-[[:xdigit:]]+-[[:xdigit:]]+$ ]]; then
  echo "Restore verification failed: PostgreSQL returned an invalid snapshot identifier." >&2
  exit 1
fi

outbox_lifecycle_digest() {
  local database_name="${1:-}"
  local snapshot_id="${2:-}"
  local transaction_command='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'

  if [[ -n "${snapshot_id}" ]]; then
    if [[ ! "${snapshot_id}" =~ ^[[:xdigit:]]+-[[:xdigit:]]+-[[:xdigit:]]+$ ]]; then
      echo "Restore verification failed: refusing an invalid snapshot identifier." >&2
      return 1
    fi
    transaction_command+=" SET TRANSACTION SNAPSHOT '${snapshot_id}';"
  fi

  compose exec -T postgres sh -eu -c '
    database_name="$1"
    if [ -z "$database_name" ]; then database_name="$POSTGRES_DB"; fi
    exec psql \
      --no-psqlrc \
      --set=ON_ERROR_STOP=1 \
      --quiet \
      --tuples-only \
      --no-align \
      --username="$POSTGRES_USER" \
      --dbname="$database_name" \
      --command="$2" \
      --file=-
  ' -- "${database_name}" "${transaction_command}" <<'SQL'
WITH lifecycle_rows AS (
  SELECT
    organization_id,
    id,
    jsonb_build_array(
      organization_id,
      id,
      status,
      attempts,
      extract(epoch FROM available_at),
      extract(epoch FROM created_at),
      extract(epoch FROM completed_at)
    )::text AS lifecycle
  FROM public.outbox_event
)
SELECT encode(
  sha256(
    convert_to(
      coalesce(string_agg(lifecycle, E'\n' ORDER BY organization_id, id), ''),
      'UTF8'
    )
  ),
  'hex'
)
FROM lifecycle_rows;
COMMIT;
SQL
}

source_outbox_lifecycle="$(outbox_lifecycle_digest "" "${source_snapshot_id}")"
if [[ ! "${source_outbox_lifecycle}" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "Restore verification failed: source outbox lifecycle digest is invalid." >&2
  exit 1
fi

compose exec -T postgres sh -eu -c \
  'exec pg_dump --format=custom --no-owner --no-privileges --snapshot="$1" --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  -- "${source_snapshot_id}" >"${dump_file}"
test -s "${dump_file}"
release_source_snapshot

compose exec -T postgres sh -eu -c \
  'createdb --username="$POSTGRES_USER" "$1"' -- "${restore_database}"
database_created=true
compose exec -T postgres sh -eu -c \
  'exec pg_restore --exit-on-error --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$1"' \
  -- "${restore_database}" <"${dump_file}"

source_objects="$(compose exec -T postgres sh -eu -c \
  'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --command="SELECT count(*) FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '\''public'\'')"')"
restored_objects="$(compose exec -T postgres sh -eu -c \
  'psql --tuples-only --no-align --username="$POSTGRES_USER" --dbname="$1" --command="SELECT count(*) FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '\''public'\'')"' \
  -- "${restore_database}")"

if [[ "${source_objects}" != "${restored_objects}" ]]; then
  echo "Restore verification failed: public-schema object counts differ." >&2
  exit 1
fi

restored_outbox_lifecycle="$(outbox_lifecycle_digest "${restore_database}")"
if [[ ! "${restored_outbox_lifecycle}" =~ ^[[:xdigit:]]{64}$ ]]; then
  echo "Restore verification failed: restored outbox lifecycle digest is invalid." >&2
  exit 1
fi

if [[ "${source_outbox_lifecycle}" != "${restored_outbox_lifecycle}" ]]; then
  echo "Restore verification failed: outbox lifecycle records differ." >&2
  exit 1
fi

echo "Database dump/restore verification passed in an isolated temporary database."
