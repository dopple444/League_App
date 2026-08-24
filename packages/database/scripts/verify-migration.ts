import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { waitForDatabaseReadiness } from './wait-for-database.js';

const migrationUrl =
  process.env.HOST_TEST_MIGRATOR_DATABASE_URL ?? process.env.TEST_MIGRATOR_DATABASE_URL;
if (migrationUrl === undefined || migrationUrl.length === 0) {
  throw new Error('HOST_TEST_MIGRATOR_DATABASE_URL or TEST_MIGRATOR_DATABASE_URL is required.');
}

const prisma = fileURLToPath(new URL('../node_modules/.bin/prisma', import.meta.url));
const config = fileURLToPath(new URL('../prisma.config.ts', import.meta.url));
const migrate = () =>
  execFileSync(prisma, ['migrate', 'deploy', '--config', config], {
    env: { ...process.env, DATABASE_URL: migrationUrl },
    stdio: 'inherit',
  });

await waitForDatabaseReadiness(
  async () => {
    const readinessClient = new Client({
      connectionString: migrationUrl,
      connectionTimeoutMillis: 1_000,
      query_timeout: 1_000,
    });
    let connected = false;
    try {
      await readinessClient.connect();
      connected = true;
      await readinessClient.query('SELECT 1');
    } finally {
      if (connected) await readinessClient.end().catch(() => undefined);
    }
  },
  { maxAttempts: 12, retryDelayMs: 500 },
);

migrate();

const client = new Client({ connectionString: migrationUrl });
await client.connect();
try {
  await client.query(`
    DO $grant$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
        GRANT USAGE ON SCHEMA public, app TO league_test;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO league_test;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO league_test;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO league_test;
        REVOKE UPDATE, DELETE ON audit_event, season_configuration_revision FROM league_test;
        REVOKE DELETE ON publication_snapshot FROM league_test;
        REVOKE SELECT, INSERT, UPDATE, DELETE ON platform_permission_grant FROM league_test;
        REVOKE UPDATE, DELETE ON platform_audit_event FROM league_test;
      END IF;
    END
    $grant$;
  `);
} finally {
  await client.end();
}

migrate();
