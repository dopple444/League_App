import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const envPath = path.join(root, '.env');
if (!existsSync(envPath)) {
  console.error('Local .env is missing. Run `pnpm env:init` first.');
  process.exit(1);
}

function parseEnvironment(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

function requireValue(environment, key) {
  const value = environment[key];
  if (value === undefined || value.length === 0) throw new Error(`Local .env is missing ${key}.`);
  return value;
}

function requireLoopbackDatabase(value, key) {
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54320') {
    throw new Error(`${key} must target the loopback test port 54320.`);
  }
  return value;
}

const [profile, separator, command, ...commandArguments] = process.argv.slice(2);
if (separator !== '--' || command === undefined) {
  throw new Error('Usage: run-with-env.mjs <profile> -- <command> [arguments...]');
}

const localEnvironment = parseEnvironment(readFileSync(envPath, 'utf8'));
const childEnvironment = { ...process.env, ...localEnvironment };
const hostMigrator = requireLoopbackDatabase(
  requireValue(localEnvironment, 'HOST_TEST_MIGRATOR_DATABASE_URL'),
  'HOST_TEST_MIGRATOR_DATABASE_URL',
);
const hostTest = requireLoopbackDatabase(
  requireValue(localEnvironment, 'HOST_TEST_DATABASE_URL'),
  'HOST_TEST_DATABASE_URL',
);

switch (profile) {
  case 'database-migration':
    childEnvironment.DATABASE_URL = hostMigrator;
    childEnvironment.DIRECT_URL = hostMigrator;
    break;
  case 'database-seed': {
    const hostDatabase = requireLoopbackDatabase(
      requireValue(localEnvironment, 'HOST_DATABASE_URL'),
      'HOST_DATABASE_URL',
    );
    childEnvironment.DATABASE_URL = hostDatabase;
    childEnvironment.DIRECT_URL = hostDatabase;
    childEnvironment.RUNTIME_DATABASE_URL = requireLoopbackDatabase(
      requireValue(localEnvironment, 'HOST_RUNTIME_DATABASE_URL'),
      'HOST_RUNTIME_DATABASE_URL',
    );
    break;
  }
  case 'api-test':
    childEnvironment.DATABASE_URL = hostTest;
    childEnvironment.DIRECT_URL = hostMigrator;
    childEnvironment.RUNTIME_DATABASE_URL = hostTest;
    childEnvironment.TEST_DATABASE_URL = hostTest;
    childEnvironment.TEST_MIGRATOR_DATABASE_URL = hostMigrator;
    break;
  case 'web-test': {
    const gatewayUrl = new URL(requireValue(localEnvironment, 'WEB_ORIGIN'));
    if (!['127.0.0.1', 'localhost'].includes(gatewayUrl.hostname)) {
      throw new Error('WEB_ORIGIN must target loopback for local browser tests.');
    }
    childEnvironment.PLAYWRIGHT_BASE_URL = gatewayUrl.toString();
    break;
  }
  default:
    throw new Error(`Unknown environment profile: ${profile}`);
}

const result = spawnSync(command, commandArguments, {
  cwd: root,
  env: childEnvironment,
  stdio: 'inherit',
});
if (result.error !== undefined) throw result.error;
process.exit(result.status ?? 1);
