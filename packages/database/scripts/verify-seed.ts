import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const databaseUrls = [
  process.env.DATABASE_URL,
  process.env.HOST_TEST_MIGRATOR_DATABASE_URL ?? process.env.TEST_MIGRATOR_DATABASE_URL,
].filter((value): value is string => value !== undefined && value.length > 0);
if (databaseUrls.length === 0) {
  throw new Error('DATABASE_URL or a test migrator database URL is required.');
}

const tsx = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url));
const seed = fileURLToPath(new URL('../prisma/seed.ts', import.meta.url));
for (const databaseUrl of new Set(databaseUrls)) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    execFileSync(tsx, [seed], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });
  }
}
