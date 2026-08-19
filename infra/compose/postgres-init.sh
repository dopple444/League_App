#!/usr/bin/env bash
set -euo pipefail

psql --set ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<'SQL'
\getenv runtime_password RUNTIME_DATABASE_PASSWORD
\getenv test_password TEST_DATABASE_PASSWORD

SELECT format(
  'CREATE ROLE league_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'runtime_password'
) \gexec
SELECT format(
  'CREATE ROLE league_test LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'test_password'
) \gexec

CREATE DATABASE league_app_test OWNER league_migrator;
REVOKE ALL ON DATABASE league_app FROM PUBLIC;
REVOKE ALL ON DATABASE league_app_test FROM PUBLIC;
GRANT CONNECT ON DATABASE league_app TO league_runtime;
GRANT CONNECT ON DATABASE league_app_test TO league_test;
SQL
