import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const envPath = path.join(root, '.env');
if (!existsSync(envPath)) {
  console.error(
    'ERROR Local .env is missing. Run `pnpm env:init` to generate ignored local secrets.',
  );
  process.exit(1);
}
const required = [
  'API_PORT',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'DATABASE_URL',
  'DEMO_ADMIN_PASSWORD',
  'HOST_DATABASE_URL',
  'HOST_RUNTIME_DATABASE_URL',
  'HOST_TEST_DATABASE_URL',
  'HOST_TEST_MIGRATOR_DATABASE_URL',
  'LEAGUE_TIMEZONE',
  'MINIO_ROOT_PASSWORD',
  'MINIO_ROOT_USER',
  'MOBILE_ORIGIN',
  'POSTGRES_DB',
  'POSTGRES_PASSWORD',
  'POSTGRES_USER',
  'REDIS_URL',
  'RUNTIME_DATABASE_URL',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'SCHEDULER_URL',
  'TEST_DATABASE_URL',
  'TEST_MIGRATOR_DATABASE_URL',
  'WEB_ORIGIN',
];

function parseEnv(source) {
  const entries = [];
  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error(`Invalid environment line: ${rawLine}`);
    entries.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()]);
  }
  return Object.fromEntries(entries);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
const errors = [];
for (const key of required) {
  if (env[key] === undefined || env[key] === '') errors.push(`${key} is required.`);
}

for (const [key, value] of Object.entries(env)) {
  if (/^(CHANGEME|PASSWORD|SECRET|__GENERATE_[A-Z_]+__)$/u.test(value)) {
    errors.push(`${key} still contains a placeholder value.`);
  }
  if (/prod(uction)?/iu.test(value) && env.NODE_ENV !== 'production') {
    errors.push(`${key} appears to reference production from a non-production environment.`);
  }
}

const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const featuredPublicSlugs = ['FEATURED_PUBLIC_ORGANIZATION_SLUG', 'FEATURED_PUBLIC_LEAGUE_SLUG'];
const configuredFeaturedPublicSlugs = featuredPublicSlugs.filter(
  (key) => env[key] !== undefined && env[key] !== '',
);
if (
  configuredFeaturedPublicSlugs.length > 0 &&
  configuredFeaturedPublicSlugs.length !== featuredPublicSlugs.length
) {
  errors.push('Featured public organization and league slugs must be configured together.');
}
for (const key of configuredFeaturedPublicSlugs) {
  const value = env[key];
  if (value.length < 2 || value.length > 80 || !publicSlugPattern.test(value)) {
    errors.push(
      `${key} must contain 2-80 lowercase letters, numbers, or single hyphen separators.`,
    );
  }
}

try {
  new Intl.DateTimeFormat('en-US', { timeZone: env.LEAGUE_TIMEZONE }).format();
} catch {
  errors.push('LEAGUE_TIMEZONE must be a valid IANA timezone.');
}

for (const urlKey of [
  'BETTER_AUTH_URL',
  'DATABASE_URL',
  'HOST_DATABASE_URL',
  'HOST_RUNTIME_DATABASE_URL',
  'HOST_TEST_DATABASE_URL',
  'HOST_TEST_MIGRATOR_DATABASE_URL',
  'MOBILE_ORIGIN',
  'REDIS_URL',
  'S3_ENDPOINT',
  'SCHEDULER_URL',
  'TEST_DATABASE_URL',
  'TEST_MIGRATOR_DATABASE_URL',
]) {
  try {
    new URL(env[urlKey]);
  } catch {
    errors.push(`${urlKey} must be a valid URL.`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  const sourceDocs = path.join(root, 'import/source-docs');
  console.log(
    `Environment structure is valid (${path.basename(envPath)}; values were not printed).`,
  );
  if (!existsSync(sourceDocs)) {
    console.log(
      'INFO import/source-docs is absent; source traceability remains intentionally pending.',
    );
  }
}
