import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const rootPackage = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const expectedNode = readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim();
const expectedPython = readFileSync(
  new URL('../../.python-version', import.meta.url),
  'utf8',
).trim();
const expectedPnpm = rootPackage.packageManager.replace('pnpm@', '');
const strict = process.env.LEAGUE_STRICT_TOOLCHAIN === '1' || process.env.CI === 'true';
const errors = [];
const warnings = [];

function commandVersion(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function recordVersion(name, actual, expected, normalize = (value) => value) {
  if (actual === undefined) {
    errors.push(`${name} is not installed; expected ${expected}.`);
    return;
  }

  if (normalize(actual) !== expected) {
    const message = `${name} ${actual} is active; the repository pin is ${expected}.`;
    if (strict) errors.push(message);
    else warnings.push(message);
  }
}

recordVersion('Node.js', process.version, expectedNode, (value) => value.replace(/^v/, ''));
recordVersion('pnpm', commandVersion('pnpm', ['--version']), expectedPnpm);
recordVersion('Python', commandVersion('python3', ['--version']), expectedPython, (value) =>
  value.replace(/^Python\s+/, ''),
);

const dockerVersion = commandVersion('docker', ['--version']);
const composeVersion = commandVersion('docker', ['compose', 'version']);
if (dockerVersion === undefined || composeVersion === undefined) {
  errors.push('Docker Engine with the Compose plugin is required for the local stack.');
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(
    'Install the pinned tools with mise, or run `corepack enable && corepack install --global pnpm@11.22.0` after installing Node 24.19.0.',
  );
  process.exitCode = 1;
} else {
  console.log(
    warnings.length === 0
      ? `Toolchain ready (Node ${expectedNode}, pnpm ${expectedPnpm}, Python ${expectedPython}, Docker Compose).`
      : 'Repository pins and Docker Compose are valid; local patch deviations above are enforced strictly in CI and pinned containers.',
  );
}
