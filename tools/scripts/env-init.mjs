import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const target = path.join(root, '.env');
const template = path.join(root, '.env.example');
const ciMode = process.argv.slice(2).includes('--ci');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--ci');
if (unknownArguments.length > 0)
  throw new Error(`Unknown argument: ${unknownArguments.join(', ')}`);
if (ciMode && process.env.CI !== 'true') throw new Error('--ci may only be used when CI=true.');

if (existsSync(target)) {
  let current = readFileSync(target, 'utf8');
  const values = Object.fromEntries(
    current
      .split(/\r?\n/u)
      .filter((line) => /^[A-Z0-9_]+=/u.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  let addedDerivedValues = false;
  if (values.MOBILE_ORIGIN === undefined) {
    current += 'MOBILE_ORIGIN=league-companion://\n';
    values.MOBILE_ORIGIN = 'league-companion://';
    addedDerivedValues = true;
  }
  const publicLeagueDefaults = {
    FEATURED_PUBLIC_ORGANIZATION_SLUG: 'meade-county-demo',
    FEATURED_PUBLIC_LEAGUE_SLUG: 'church-softball',
  };
  const missingPublicLeagueKeys = Object.keys(publicLeagueDefaults).filter(
    (key) => values[key] === undefined,
  );
  if (missingPublicLeagueKeys.length === 1) {
    throw new Error(
      'Existing .env must configure featured public organization and league slugs together; no values were changed.',
    );
  }
  if (missingPublicLeagueKeys.length === 2) {
    for (const [key, value] of Object.entries(publicLeagueDefaults)) {
      current += `${key}=${value}\n`;
      values[key] = value;
    }
    addedDerivedValues = true;
  }
  if (values.TEST_MIGRATOR_DATABASE_URL === undefined) {
    const databaseUrl = values.DATABASE_URL;
    if (databaseUrl === undefined) throw new Error('Existing .env has no DATABASE_URL.');
    const testMigratorUrl = new URL(databaseUrl);
    testMigratorUrl.pathname = '/league_app_test';
    current += `\nTEST_MIGRATOR_DATABASE_URL=${testMigratorUrl.toString()}\n`;
    values.TEST_MIGRATOR_DATABASE_URL = testMigratorUrl.toString();
  }
  const hostSources = {
    HOST_DATABASE_URL: 'DATABASE_URL',
    HOST_RUNTIME_DATABASE_URL: 'RUNTIME_DATABASE_URL',
    HOST_TEST_DATABASE_URL: 'TEST_DATABASE_URL',
    HOST_TEST_MIGRATOR_DATABASE_URL: 'TEST_MIGRATOR_DATABASE_URL',
  };
  for (const [hostKey, sourceKey] of Object.entries(hostSources)) {
    if (values[hostKey] !== undefined) continue;
    const sourceValue = values[sourceKey];
    if (sourceValue === undefined) throw new Error(`Existing .env has no ${sourceKey}.`);
    const hostUrl = new URL(sourceValue);
    hostUrl.hostname = '127.0.0.1';
    hostUrl.port = '54320';
    current += `${hostKey}=${hostUrl.toString()}\n`;
    addedDerivedValues = true;
  }
  if (addedDerivedValues || !/^TEST_MIGRATOR_DATABASE_URL=/mu.test(readFileSync(target, 'utf8'))) {
    writeFileSync(target, current, { encoding: 'utf8', mode: 0o600 });
    console.log('Added missing derived local settings; no secret values were printed.');
  } else {
    console.log('Local .env already exists; no values were changed.');
  }
  chmodSync(target, 0o600);
  process.exit(0);
}

const templateText = readFileSync(template, 'utf8');
const placeholders = [
  '__GENERATE_POSTGRES_PASSWORD__',
  '__GENERATE_RUNTIME_DATABASE_PASSWORD__',
  '__GENERATE_TEST_DATABASE_PASSWORD__',
  '__GENERATE_MINIO_PASSWORD__',
  '__GENERATE_BETTER_AUTH_SECRET__',
  '__GENERATE_DEMO_ADMIN_PASSWORD__',
];
const ciEnvironmentNames = {
  __GENERATE_POSTGRES_PASSWORD__: 'CI_SYNTHETIC_POSTGRES_PASSWORD',
  __GENERATE_RUNTIME_DATABASE_PASSWORD__: 'CI_SYNTHETIC_RUNTIME_DATABASE_PASSWORD',
  __GENERATE_TEST_DATABASE_PASSWORD__: 'CI_SYNTHETIC_TEST_DATABASE_PASSWORD',
  __GENERATE_MINIO_PASSWORD__: 'CI_SYNTHETIC_MINIO_PASSWORD',
  __GENERATE_BETTER_AUTH_SECRET__: 'CI_SYNTHETIC_BETTER_AUTH_SECRET',
  __GENERATE_DEMO_ADMIN_PASSWORD__: 'CI_SYNTHETIC_DEMO_ADMIN_PASSWORD',
};
let rendered = templateText;
for (const placeholder of placeholders) {
  if (!rendered.includes(placeholder)) {
    throw new Error(`Environment template is missing ${placeholder}.`);
  }
  const ciEnvironmentName = ciEnvironmentNames[placeholder];
  const replacement = ciMode
    ? process.env[ciEnvironmentName]
    : randomBytes(32).toString('base64url');
  if (replacement === undefined || replacement.length < 20) {
    throw new Error(
      `${ciEnvironmentName} must contain an explicit synthetic value of 20+ characters.`,
    );
  }
  if (ciMode && !replacement.startsWith('ci-synthetic-')) {
    throw new Error(`${ciEnvironmentName} must begin with ci-synthetic-.`);
  }
  rendered = rendered.replaceAll(placeholder, replacement);
}
if (/__GENERATE_[A-Z_]+__/u.test(rendered)) {
  throw new Error('Environment template has an unknown secret placeholder.');
}

const file = openSync(target, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
writeFileSync(file, rendered, { encoding: 'utf8' });
closeSync(file);
console.log(
  'Created ignored .env with generated local-only secrets; no secret values were printed.',
);
