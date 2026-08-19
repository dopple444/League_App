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

compose() {
  docker compose --env-file "${env_file}" -f "${compose_file}" "$@"
}

cleanup() {
  if [[ "${database_created}" == true ]]; then
    compose exec -T postgres sh -eu -c \
      'dropdb --if-exists --force --username="$POSTGRES_USER" "$1"' -- "${restore_database}" >/dev/null
  fi
  if [[ -f "${dump_file}" ]]; then rm -f -- "${dump_file}"; fi
  rmdir "${temporary_directory}" 2>/dev/null || true
}
trap cleanup EXIT

compose exec -T postgres sh -eu -c \
  'exec pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  >"${dump_file}"
test -s "${dump_file}"

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

echo "Database dump/restore verification passed in an isolated temporary database."
