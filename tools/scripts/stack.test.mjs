import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const scriptUrl = new URL('./stack.sh', import.meta.url);

test('recreates the gateway after rebuilding application containers', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'league-stack-'));
  const scriptPath = path.join(fixtureRoot, 'tools/scripts/stack.sh');
  const fakeDockerPath = path.join(fixtureRoot, 'bin/docker');
  const callsPath = path.join(fixtureRoot, 'docker-calls.txt');

  try {
    await Promise.all([
      mkdir(path.dirname(scriptPath), { recursive: true }),
      mkdir(path.dirname(fakeDockerPath), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(scriptPath, await readFile(scriptUrl, 'utf8')),
      writeFile(path.join(fixtureRoot, '.env'), 'COMPOSE_PROJECT_NAME=league-test\n'),
      writeFile(
        fakeDockerPath,
        '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "${FAKE_DOCKER_CALLS}"\n',
      ),
    ]);
    await Promise.all([chmod(scriptPath, 0o755), chmod(fakeDockerPath, 0o755)]);

    const result = spawnSync('bash', [scriptPath, 'up'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FAKE_DOCKER_CALLS: callsPath,
        PATH: `${path.dirname(fakeDockerPath)}:${process.env.PATH ?? ''}`,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    const calls = (await readFile(callsPath, 'utf8')).trim().split('\n');
    assert.equal(calls.length, 2);
    assert.match(calls[0], /^compose .* up --detach --build --wait$/u);
    assert.match(calls[1], /^compose .* up --detach --no-deps --force-recreate --wait gateway$/u);
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
