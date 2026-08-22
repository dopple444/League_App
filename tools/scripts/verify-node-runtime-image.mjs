import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dockerfilePath = resolve(repoRoot, 'infra/docker/node-service.Dockerfile');
const dockerignorePath = resolve(repoRoot, '.dockerignore');
const dockerfile = readFileSync(dockerfilePath, 'utf8');
const dockerignore = readFileSync(dockerignorePath, 'utf8');

const fail = (message) => {
  throw new Error(`Node runtime image check failed: ${message}`);
};

const requireText = (source, expected, message) => {
  if (!source.includes(expected)) {
    fail(message);
  }
};

const fromLines = dockerfile.match(/^FROM .+$/gmu) ?? [];
assert.equal(fromLines.length, 3, 'Dockerfile must contain build, package, and runtime stages');
requireText(fromLines[0] ?? '', ' AS build', 'first Docker stage must be named build');
requireText(
  fromLines[1] ?? '',
  'FROM build AS package',
  'second Docker stage must package build output',
);
requireText(fromLines[2] ?? '', ' AS runtime', 'final Docker stage must be named runtime');

const runtimeStage = dockerfile.slice(dockerfile.lastIndexOf('\nFROM ') + 1);
requireText(runtimeStage, 'COPY --from=package', 'runtime must copy only packaging-stage output');
requireText(runtimeStage, 'USER node', 'runtime must execute as the node user');
requireText(
  runtimeStage,
  'apps/web/server.js',
  'runtime command must use the standalone web server',
);
requireText(
  runtimeStage,
  'apps/api/dist/src/main.js',
  'runtime command must use compiled API output',
);
requireText(
  runtimeStage,
  'apps/worker/dist/main.js',
  'runtime command must use compiled worker output',
);
requireText(runtimeStage, 'rm -rf /usr/local/lib/node_modules/npm', 'runtime must remove npm');
if (/^COPY (?:--[^ ]+ )*(?:apps|packages)(?: |\/)/mu.test(runtimeStage)) {
  fail('runtime stage must not copy repository apps or packages directly');
}

requireText(dockerfile, 'apps/web/.next/standalone', 'web package must use Next standalone output');
requireText(
  dockerfile,
  'node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers',
  'web package must retain the complete SWC helpers runtime',
);
requireText(
  dockerfile,
  'deploy --prod --legacy',
  'API and worker must use production deploy output',
);
requireText(
  dockerfile,
  'pnpm --workspace-concurrency=1 --filter "${WORKSPACE}..." build',
  'workspace builds must remain serialized to avoid exhausting constrained builders',
);
requireText(
  dockerfile,
  'pnpm --filter @league/database deploy --prod --legacy',
  'API must retain its migration package',
);
requireText(
  dockerfile,
  'dependencies.prisma=7.9.1',
  'API migration package must retain the pinned Prisma CLI',
);
requireText(dockerignore, '.env.*', 'Docker context must ignore environment files');
requireText(dockerignore, '*.key', 'Docker context must ignore private key files');
requireText(dockerignore, 'import/source-docs', 'Docker context must ignore source documents');

const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!argument?.startsWith('--')) {
    fail(`unexpected argument ${argument ?? ''}`);
  }
  const inlineSeparator = argument.indexOf('=');
  if (inlineSeparator > 2) {
    argumentsByName.set(argument.slice(2, inlineSeparator), argument.slice(inlineSeparator + 1));
    continue;
  }
  const name = argument.slice(2);
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`missing value for --${name}`);
  }
  argumentsByName.set(name, value);
  index += 1;
}

const image = argumentsByName.get('image');
const workspace = argumentsByName.get('workspace');
if (Boolean(image) !== Boolean(workspace)) {
  fail('--image and --workspace must be supplied together');
}

const allowedWorkspaces = new Set(['@league/web', '@league/api', '@league/worker']);
if (workspace && !allowedWorkspaces.has(workspace)) {
  fail(`unsupported workspace ${workspace}`);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
};

if (image && workspace) {
  const inspect = run('docker', ['image', 'inspect', image, '--format', '{{json .Config}}']);
  if (inspect.status !== 0) {
    fail(`cannot inspect ${image}: ${inspect.stderr.trim()}`);
  }
  const config = JSON.parse(inspect.stdout);
  assert.equal(config.User, 'node', `${image} must set Config.User=node`);
  assert.ok(
    config.Env.includes(`WORKSPACE=${workspace}`),
    `${image} must record WORKSPACE=${workspace}`,
  );
  assert.ok(config.Env.includes('NODE_ENV=production'), `${image} must set production mode`);

  const appName = workspace.slice('@league/'.length);
  const commonRuntimeCheck = String.raw`
set -eu
test "$(id -u)" = "1000"
test "$(id -g)" = "1000"
test ! -e /usr/local/bin/npm
test ! -e /usr/local/bin/npx
test ! -e "/app/apps/${appName}/src"
test ! -e "/app/apps/${appName}/test"
test ! -e "/app/apps/${appName}/tsconfig.json"
test ! -e "/app/apps/${appName}/.turbo"
test -z "$(find /app -type d -name .turbo -print -quit)"
if [ -d "/app/apps/${appName}/node_modules/.pnpm" ]; then
  find "/app/apps/${appName}/node_modules/.pnpm" \
    -regextype posix-extended \
    -type d \
    -regex '.*/node_modules/@league/[^/]+$' \
    -exec sh -eu -c 'for package_root do
      for removed_path in .turbo src test scripts prisma dist/test; do
        test ! -e "$package_root/$removed_path"
      done
    done' sh '{}' +
fi
if [ -d "/app/apps/${appName}/node_modules/@league" ]; then
  for package_root in "/app/apps/${appName}/node_modules/@league"/*; do
    test -f "$package_root/package.json"
    test -f "$package_root/dist/src/index.js"
  done
fi
for dev_tool in tsc tsx vitest; do
  test ! -e "/app/apps/${appName}/node_modules/.bin/$dev_tool"
done
`;

  let workspaceRuntimeCheck;
  if (workspace === '@league/web') {
    workspaceRuntimeCheck = String.raw`
test -f /app/apps/web/server.js
test -d /app/apps/web/.next/static
test -n "$(find /app/node_modules/.pnpm -path '*/@swc/helpers/esm/_interop_require_default.js' -print -quit)"
! command -v pnpm >/dev/null 2>&1
! command -v corepack >/dev/null 2>&1
`;
  } else if (workspace === '@league/api') {
    workspaceRuntimeCheck = String.raw`
test -f /app/apps/api/dist/src/main.js
test -f /app/packages/database/prisma.config.ts
test -f /app/packages/database/prisma/schema.prisma
test -d /app/packages/database/prisma/migrations
test -x /app/packages/database/node_modules/.bin/prisma
test ! -e /app/packages/database/node_modules/.bin/tsc
test ! -e /app/packages/database/node_modules/.bin/tsx
test ! -e /app/packages/database/node_modules/.bin/vitest
test "$(pnpm --version)" = "11.22.0"
`;
  } else {
    workspaceRuntimeCheck = String.raw`
test -f /app/apps/worker/dist/main.js
! command -v pnpm >/dev/null 2>&1
! command -v corepack >/dev/null 2>&1
`;
  }

  const contentCheck = run('docker', [
    'run',
    '--rm',
    '--entrypoint',
    'sh',
    image,
    '-c',
    `${commonRuntimeCheck}\n${workspaceRuntimeCheck}`,
  ]);
  if (contentCheck.status !== 0) {
    fail(
      `${image} runtime contents are invalid:\n${contentCheck.stdout}${contentCheck.stderr}`.trim(),
    );
  }

  if (workspace === '@league/api') {
    const migrationCheck = run(
      'docker',
      [
        'run',
        '--rm',
        '--env',
        'DATABASE_URL=postgresql://runtime_probe:runtime_probe@127.0.0.1:1/runtime_probe?connect_timeout=1',
        image,
        'pnpm',
        '--filter',
        '@league/database',
        'db:migrate',
      ],
      { timeout: 45_000 },
    );
    const migrationOutput = `${migrationCheck.stdout}\n${migrationCheck.stderr}`;
    if (migrationCheck.status === 0) {
      fail('migration probe unexpectedly connected to the deliberately unavailable database');
    }
    if (migrationCheck.signal === 'SIGTERM') {
      fail('migration probe timed out before reaching the database boundary');
    }
    if (!migrationOutput.includes('prisma migrate deploy')) {
      fail(`migration script did not invoke Prisma:\n${migrationOutput}`);
    }
    if (!/P1001|Can(?:not|'t) reach database server/iu.test(migrationOutput)) {
      fail(`migration probe did not reach the expected database boundary:\n${migrationOutput}`);
    }
    if (
      /ERR_PNPM_(?:NO_IMPORTER_MANIFEST_FOUND|WORKSPACE_PKG_NOT_FOUND)|command not found|Could not find Prisma Schema/iu.test(
        migrationOutput,
      )
    ) {
      fail(`migration runtime contract is incomplete:\n${migrationOutput}`);
    }
  }

  console.log(`Node runtime image ${image} (${workspace}) is valid.`);
} else {
  console.log('Node runtime Dockerfile constraints are valid.');
}
