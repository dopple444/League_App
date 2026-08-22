import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const exceptionIds = ['GHSA-w3rx-r6r6-pgpr', 'GHSA-5p2g-fcmc-qvqq'];
const exceptionExpiry = '2026-09-15';
const scriptUrl = new URL('./security-dependencies.sh', import.meta.url);
const checkerUrl = new URL('./check-dependency-audit.mjs', import.meta.url);
const recordUrl = new URL('../../docs/assurance/SECURITY_EXCEPTIONS.md', import.meta.url);
const workspaceUrl = new URL('../../pnpm-workspace.yaml', import.meta.url);
const validLockfile = `lockfileVersion: '9.0'

importers:
  apps/mobile:
    dependencies:
      expo:
        specifier: 57.0.13
        version: 57.0.13
  apps/api:
    dependencies: {}

snapshots:
  expo@57.0.13:
    dependencies:
      metro: 0.84.4
  metro@0.84.4:
    dependencies:
      image-size: 1.2.1
  image-size@1.2.1: {}
`;
const validWorkspaceConfig = `packages:
  - apps/*
  - packages/*
`;

function auditReport(advisories, countOverrides = {}) {
  const counts = { info: 0, low: 0, moderate: 1, high: 0, critical: 0, ...countOverrides };
  const advisoryEntries = advisories.map((auditAdvisory, index) => {
    counts[auditAdvisory.severity] += 1;
    return [String(index + 1), auditAdvisory];
  });
  return JSON.stringify({
    advisories: Object.fromEntries(advisoryEntries),
    metadata: { vulnerabilities: counts },
  });
}

function advisory(githubAdvisoryId, severity = 'high', overrides = {}) {
  return {
    github_advisory_id: githubAdvisoryId,
    severity,
    module_name: 'image-size',
    findings: [
      {
        version: '1.2.1',
        paths: ['apps__mobile>expo>@expo/cli>@expo/metro>metro>image-size'],
      },
    ],
    ...overrides,
  };
}

async function runPolicyFixture({
  auditExit,
  auditJson,
  auditStderr = '',
  currentDate,
  lockfile = validLockfile,
  pythonFailMatch = '',
  workspaceConfig = validWorkspaceConfig,
}) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'league-dependency-security-'));
  const scriptPath = path.join(fixtureRoot, 'tools/scripts/security-dependencies.sh');
  const checkerPath = path.join(fixtureRoot, 'tools/scripts/check-dependency-audit.mjs');
  const recordPath = path.join(fixtureRoot, 'docs/assurance/SECURITY_EXCEPTIONS.md');
  const binaryPath = path.join(fixtureRoot, 'bin');
  const schedulerPython = path.join(fixtureRoot, 'services/scheduler/.venv/bin/python');
  const auditArgumentsPath = path.join(fixtureRoot, 'audit-arguments.txt');
  const pythonArgumentsPath = path.join(fixtureRoot, 'python-arguments.txt');
  const lockfilePath = path.join(fixtureRoot, 'pnpm-lock.yaml');
  const workspaceConfigPath = path.join(fixtureRoot, 'pnpm-workspace.yaml');

  try {
    await Promise.all([
      mkdir(path.dirname(scriptPath), { recursive: true }),
      mkdir(path.dirname(recordPath), { recursive: true }),
      mkdir(binaryPath, { recursive: true }),
      mkdir(path.dirname(schedulerPython), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(scriptPath, await readFile(scriptUrl, 'utf8')),
      writeFile(checkerPath, await readFile(checkerUrl, 'utf8')),
      writeFile(recordPath, await readFile(recordUrl, 'utf8')),
      writeFile(lockfilePath, lockfile),
      writeFile(workspaceConfigPath, workspaceConfig),
      writeFile(pythonArgumentsPath, ''),
      writeFile(
        path.join(binaryPath, 'date'),
        '#!/usr/bin/env bash\nprintf \'%s\\n\' "${FAKE_UTC_DATE}"\n',
      ),
      writeFile(
        path.join(binaryPath, 'pnpm'),
        [
          '#!/usr/bin/env bash',
          'printf \'%s\\n\' "$@" > "${FAKE_AUDIT_ARGUMENTS}"',
          'printf \'%s\' "${FAKE_AUDIT_JSON}"',
          'printf \'%s\' "${FAKE_AUDIT_STDERR}" >&2',
          'exit "${FAKE_AUDIT_EXIT}"',
          '',
        ].join('\n'),
      ),
      writeFile(
        schedulerPython,
        [
          '#!/usr/bin/env bash',
          'printf \'%s\\n\' "$*" >> "${FAKE_PYTHON_ARGUMENTS}"',
          'if [[ -n "${FAKE_PYTHON_FAIL_MATCH:-}" && "$*" == *"${FAKE_PYTHON_FAIL_MATCH}"* ]]; then exit 1; fi',
          'exit 0',
          '',
        ].join('\n'),
      ),
    ]);
    await Promise.all([
      chmod(scriptPath, 0o755),
      chmod(checkerPath, 0o755),
      chmod(path.join(binaryPath, 'date'), 0o755),
      chmod(path.join(binaryPath, 'pnpm'), 0o755),
      chmod(schedulerPython, 0o755),
    ]);

    const result = spawnSync('bash', [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        FAKE_AUDIT_ARGUMENTS: auditArgumentsPath,
        FAKE_AUDIT_EXIT: String(auditExit),
        FAKE_AUDIT_JSON: auditJson,
        FAKE_AUDIT_STDERR: auditStderr,
        FAKE_UTC_DATE: currentDate,
        FAKE_PYTHON_ARGUMENTS: pythonArgumentsPath,
        FAKE_PYTHON_FAIL_MATCH: pythonFailMatch,
        PATH: `${binaryPath}:${process.env.PATH ?? ''}`,
      },
    });
    const auditArguments = (await readFile(auditArgumentsPath, 'utf8')).trim().split('\n');
    const pythonArguments = (await readFile(pythonArgumentsPath, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean);
    return { ...result, auditArguments, pythonArguments };
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
}

test('links an exact non-mutating allowlist to its approved exception record', async () => {
  const [script, checker, record, workspace] = await Promise.all([
    readFile(scriptUrl, 'utf8'),
    readFile(checkerUrl, 'utf8'),
    readFile(recordUrl, 'utf8'),
    readFile(workspaceUrl, 'utf8'),
  ]);
  const checkerAdvisories = [...checker.matchAll(/GHSA-[a-z0-9-]+/gu)].map((match) => match[0]);

  assert.deepEqual(checkerAdvisories, exceptionIds);
  assert.match(checker, /const exceptionExpiry = '2026-09-15';/u);
  assert.match(checker, /docs\/assurance\/SECURITY_EXCEPTIONS\.md/u);
  assert.match(script, /pnpm audit --prod --audit-level high --json/u);
  assert.match(script, /scheduler-sync\.sh" --frozen/u);
  assert.doesNotMatch(`${script}\n${checker}`, /--ignore(?:-unfixable)?\b/u);
  const prohibitedWorkspaceAuditConfig = /^(?:audit|auditConfig|ignoreGhsas):(?:\s|$)/mu;
  assert.doesNotMatch(workspace, prohibitedWorkspaceAuditConfig);
  assert.match('audit:\n  ignore:\n    - GHSA-xxxx-xxxx-xxxx', prohibitedWorkspaceAuditConfig);
  for (const exceptionId of exceptionIds) assert.match(record, new RegExp(exceptionId, 'u'));
  assert.match(record, /\*\*Owner:\*\* Repository owner\./u);
  assert.match(record, /\*\*Approval date:\*\* 2026-08-21\./u);
  assert.match(record, /\*\*Expiry:\*\* 2026-09-15\./u);
  assert.match(record, /\*\*Dependency path:\*\*/u);
  assert.match(record, /\*\*Reachability:\*\*/u);
  assert.match(record, /\*\*Compensating controls:\*\*/u);
  assert.match(record, /\*\*Removal trigger:\*\*/u);
});

test('accepts and visibly reports only the two approved advisories before expiry', async () => {
  const auditJson = auditReport(exceptionIds.map((exceptionId) => advisory(exceptionId)));
  const result = await runPolicyFixture({
    auditExit: 1,
    auditJson,
    currentDate: '2026-09-14',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.auditArguments, ['audit', '--prod', '--audit-level', 'high', '--json']);
  assert.match(result.stdout, /"advisories"/u);
  for (const exceptionId of exceptionIds) assert.match(result.stdout, new RegExp(exceptionId, 'u'));
  assert.match(result.stdout, new RegExp(exceptionExpiry, 'u'));
});

test('rejects both formerly approved advisories on the expiry date', async () => {
  const result = await runPolicyFixture({
    auditExit: 1,
    auditJson: auditReport(exceptionIds.map((exceptionId) => advisory(exceptionId))),
    currentDate: exceptionExpiry,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /expired on 2026-09-15/u);
  assert.match(result.stderr, /2 High\/Critical dependency advisory finding\(s\) are blocking/u);
});

test('continues to fail for any other High or Critical advisory', async () => {
  const result = await runPolicyFixture({
    auditExit: 1,
    auditJson: auditReport([advisory('GHSA-xxxx-xxxx-xxxx', 'critical')]),
    currentDate: '2026-09-14',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Blocking dependency advisory: GHSA-xxxx-xxxx-xxxx \(critical\)/u);
});

test('fails closed when pnpm returns malformed JSON or a registry error', async () => {
  const malformedResult = await runPolicyFixture({
    auditExit: 1,
    auditJson: '{not-json',
    currentDate: '2026-09-14',
  });
  const registryErrorResult = await runPolicyFixture({
    auditExit: 2,
    auditJson: '',
    auditStderr: 'ERR_PNPM_AUDIT_BAD_RESPONSE registry unavailable',
    currentDate: '2026-09-14',
  });

  assert.equal(malformedResult.status, 1);
  assert.match(malformedResult.stderr, /did not return valid JSON/u);
  assert.equal(registryErrorResult.status, 1);
  assert.match(registryErrorResult.stderr, /ERR_PNPM_AUDIT_BAD_RESPONSE/u);
  assert.match(registryErrorResult.stderr, /did not return valid JSON/u);
});

test('detects filtered advisories by comparing metadata with returned records', async () => {
  const result = await runPolicyFixture({
    auditExit: 0,
    auditJson: auditReport([], { high: 2 }),
    currentDate: '2026-09-14',
  });

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /metadata reports 2 High\/Critical finding\(s\), but 0 advisory record\(s\) were returned/u,
  );
});

test('rejects pnpm audit-ignore configuration in either workspace syntax', async () => {
  for (const workspaceConfig of [
    'auditConfig:\n  ignoreGhsas:\n    - GHSA-w3rx-r6r6-pgpr\n',
    'audit:\n  ignore:\n    - GHSA-w3rx-r6r6-pgpr\n',
  ]) {
    const result = await runPolicyFixture({
      auditExit: 1,
      auditJson: auditReport(exceptionIds.map((exceptionId) => advisory(exceptionId))),
      currentDate: '2026-09-14',
      workspaceConfig,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /workspace audit-ignore configuration is prohibited/u);
  }
});

test('rejects non-mobile or non-Metro lockfile reachability', async () => {
  const nonMobileLockfile = validLockfile.replace(
    '  apps/api:\n    dependencies: {}',
    `  apps/api:
    dependencies:
      metro:
        specifier: 0.84.4
        version: 0.84.4`,
  );
  const nonMetroLockfile = validLockfile.replace(
    '  image-size@1.2.1: {}',
    `  runtime-image-reader@1.0.0:
    dependencies:
      image-size: 1.2.1
  image-size@1.2.1: {}`,
  );

  const nonMobileResult = await runPolicyFixture({
    auditExit: 1,
    auditJson: auditReport(exceptionIds.map((exceptionId) => advisory(exceptionId))),
    currentDate: '2026-09-14',
    lockfile: nonMobileLockfile,
  });
  const nonMetroResult = await runPolicyFixture({
    auditExit: 1,
    auditJson: auditReport(exceptionIds.map((exceptionId) => advisory(exceptionId))),
    currentDate: '2026-09-14',
    lockfile: nonMetroLockfile,
  });

  assert.equal(nonMobileResult.status, 1);
  assert.match(nonMobileResult.stderr, /must be reachable only from apps\/mobile/u);
  assert.equal(nonMetroResult.status, 1);
  assert.match(nonMetroResult.stderr, /not reachable exclusively through metro@0\.84\.4/u);
});

test('rejects approved advisory IDs when report findings drift outside the exception scope', async () => {
  const scopedFinding = {
    version: '1.2.1',
    paths: ['apps__mobile>expo>@expo/metro>metro>image-size'],
  };
  const cases = [
    {
      expected: /applies to unexpected module runtime-image-reader/u,
      overrides: { module_name: 'runtime-image-reader' },
    },
    {
      expected: /applies to unexpected image-size version 2\.0\.0/u,
      overrides: { findings: [{ ...scopedFinding, version: '2.0.0' }] },
    },
    {
      expected: /out-of-scope dependency path: apps__api>metro>image-size/u,
      overrides: {
        findings: [{ ...scopedFinding, paths: ['apps__api>metro>image-size'] }],
      },
    },
    {
      expected: /out-of-scope dependency path: apps__mobile>image-size/u,
      overrides: { findings: [{ ...scopedFinding, paths: ['apps__mobile>image-size'] }] },
    },
  ];

  for (const policyCase of cases) {
    const result = await runPolicyFixture({
      auditExit: 1,
      auditJson: auditReport([
        advisory(exceptionIds[0], 'high', policyCase.overrides),
        advisory(exceptionIds[1]),
      ]),
      currentDate: '2026-09-14',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, policyCase.expected);
  }
});

test('passes a valid report with no High or Critical advisories', async () => {
  const result = await runPolicyFixture({
    auditExit: 0,
    auditJson: auditReport([]),
    currentDate: exceptionExpiry,
  });

  assert.equal(result.status, 0, result.stderr);
});

test('audits both Python lock exports after checking the synchronized environment', async () => {
  const result = await runPolicyFixture({
    auditExit: 0,
    auditJson: auditReport([]),
    currentDate: exceptionExpiry,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.pythonArguments.length, 3);
  assert.equal(result.pythonArguments[0], '-m pip check');
  assert.match(
    result.pythonArguments[1],
    /-m pip_audit --requirement .*\/requirements\.lock --strict$/u,
  );
  assert.match(
    result.pythonArguments[2],
    /-m pip_audit --requirement .*\/requirements\.runtime\.lock --strict$/u,
  );
});

test('blocks a vulnerability-audit failure from the runtime Python lock export', async () => {
  const result = await runPolicyFixture({
    auditExit: 0,
    auditJson: auditReport([]),
    currentDate: exceptionExpiry,
    pythonFailMatch: 'requirements.runtime.lock',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /dependency ecosystems contain reportable vulnerabilities/u);
  assert.ok(
    result.pythonArguments.some(
      (arguments_) =>
        arguments_.includes('--requirement') && arguments_.includes('requirements.runtime.lock'),
    ),
  );
});
