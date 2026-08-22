#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const exceptionIds = new Set(['GHSA-w3rx-r6r6-pgpr', 'GHSA-5p2g-fcmc-qvqq']);
const exceptionExpiry = '2026-09-15';
const exceptionRecordRelativePath = 'docs/assurance/SECURITY_EXCEPTIONS.md';
const exceptionModuleName = 'image-size';
const exceptionVersion = '1.2.1';
const exceptionImporterPath = 'apps__mobile';

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function unquoteYamlScalar(value) {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      fail(`Could not parse quoted pnpm lockfile value ${value}.`);
    }
  }
  return value;
}

function mappingEntry(line, expectedIndent) {
  if (line.slice(0, expectedIndent) !== ' '.repeat(expectedIndent)) return undefined;
  if (line[expectedIndent] === ' ' || line[expectedIndent] === '\t') return undefined;
  const content = line.slice(expectedIndent);
  let separator = -1;

  if (content.startsWith("'")) {
    for (let index = 1; index < content.length; index += 1) {
      if (content[index] !== "'") continue;
      if (content[index + 1] === "'") {
        index += 1;
        continue;
      }
      if (content[index + 1] === ':') separator = index + 1;
      break;
    }
  } else if (content.startsWith('"')) {
    let escaped = false;
    for (let index = 1; index < content.length; index += 1) {
      if (!escaped && content[index] === '"') {
        if (content[index + 1] === ':') separator = index + 1;
        break;
      }
      escaped = !escaped && content[index] === '\\';
      if (content[index] !== '\\') escaped = false;
    }
  } else {
    separator = content.indexOf(':');
  }

  if (separator < 1) return undefined;
  return {
    key: unquoteYamlScalar(content.slice(0, separator)),
    value: unquoteYamlScalar(content.slice(separator + 1).trim()),
  };
}

function leadingSpaces(line) {
  const indentation = line.match(/^ */u)?.[0].length ?? 0;
  if (line[indentation] === '\t') fail('Tabs are not accepted in the pnpm lockfile.');
  return indentation;
}

function addDependency(dependencies, owner, name, reference) {
  if (reference.length === 0) fail(`Dependency ${name} under ${owner} has no lockfile reference.`);
  dependencies.get(owner)?.push({ name, reference });
}

function parsePnpmLockfile(rawLockfile) {
  if (!/^lockfileVersion: ['"]?9\.0['"]?$/mu.test(rawLockfile)) {
    fail('The dependency reachability guard requires pnpm lockfile version 9.0.');
  }

  const importerDependencies = new Map();
  const snapshotDependencies = new Map();
  let section;
  let importer;
  let importerGroup;
  let importerDependency;
  let snapshot;
  let snapshotGroup;

  for (const line of rawLockfile.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue;
    const indentation = leadingSpaces(line);

    if (indentation === 0) {
      section = mappingEntry(line, 0)?.key;
      importer = undefined;
      snapshot = undefined;
      continue;
    }

    if (section === 'importers') {
      if (indentation === 2) {
        importer = mappingEntry(line, 2)?.key;
        if (!importer || importerDependencies.has(importer)) {
          fail('The pnpm lockfile contains an invalid or duplicate importer.');
        }
        importerDependencies.set(importer, []);
        importerGroup = undefined;
        importerDependency = undefined;
        continue;
      }
      if (!importer) fail('The pnpm lockfile contains importer data without an importer.');
      if (indentation === 4) {
        const key = mappingEntry(line, 4)?.key;
        importerGroup = ['dependencies', 'devDependencies', 'optionalDependencies'].includes(key)
          ? key
          : undefined;
        importerDependency = undefined;
        continue;
      }
      if (!importerGroup) continue;
      if (indentation === 6) {
        const entry = mappingEntry(line, 6);
        if (!entry) fail(`The pnpm lockfile has a malformed dependency under ${importer}.`);
        importerDependency = entry.key;
        if (entry.value.length > 0) {
          addDependency(importerDependencies, importer, importerDependency, entry.value);
        }
        continue;
      }
      if (indentation === 8 && importerDependency) {
        const entry = mappingEntry(line, 8);
        if (entry?.key === 'version') {
          addDependency(importerDependencies, importer, importerDependency, entry.value);
        }
      }
      continue;
    }

    if (section === 'snapshots') {
      if (indentation === 2) {
        snapshot = mappingEntry(line, 2)?.key;
        if (!snapshot || snapshotDependencies.has(snapshot)) {
          fail('The pnpm lockfile contains an invalid or duplicate snapshot.');
        }
        snapshotDependencies.set(snapshot, []);
        snapshotGroup = undefined;
        continue;
      }
      if (!snapshot) fail('The pnpm lockfile contains snapshot data without a snapshot.');
      if (indentation === 4) {
        const key = mappingEntry(line, 4)?.key;
        snapshotGroup = ['dependencies', 'optionalDependencies'].includes(key) ? key : undefined;
        continue;
      }
      if (snapshotGroup && indentation === 6) {
        const entry = mappingEntry(line, 6);
        if (!entry) fail(`The pnpm lockfile has a malformed dependency under ${snapshot}.`);
        addDependency(snapshotDependencies, snapshot, entry.key, entry.value);
      }
    }
  }

  if (importerDependencies.size === 0 || snapshotDependencies.size === 0) {
    fail('The pnpm lockfile contains no importers or snapshots.');
  }
  return { importerDependencies, snapshotDependencies };
}

function packageIdentity(snapshotKey) {
  const separator = snapshotKey.indexOf('@', snapshotKey.startsWith('@') ? 1 : 0);
  if (separator < 1) fail(`Could not identify pnpm snapshot ${snapshotKey}.`);
  return {
    name: snapshotKey.slice(0, separator),
    version: snapshotKey.slice(separator + 1).split('(')[0],
  };
}

function normalizeDependencyReference(name, reference) {
  if (!reference.startsWith('npm:')) return { name, reference };
  const alias = reference.slice(4);
  const separator = alias.lastIndexOf('@');
  if (separator < 1) fail(`Could not parse pnpm dependency alias ${reference}.`);
  return { name: alias.slice(0, separator), reference: alias.slice(separator + 1) };
}

function resolveSnapshotNodes(snapshotDependencies, name, reference) {
  const normalized = normalizeDependencyReference(name, reference);
  const exactKey = `${normalized.name}@${normalized.reference}`;
  if (snapshotDependencies.has(exactKey)) return [`snapshot:${exactKey}`];

  if (snapshotDependencies.has(normalized.reference)) {
    return [`snapshot:${normalized.reference}`];
  }

  const peerVariantPrefixes = [`${exactKey}(`, `${normalized.reference}(`];
  const candidates = [...snapshotDependencies.keys()]
    .filter((key) => peerVariantPrefixes.some((prefix) => key.startsWith(prefix)))
    .map((key) => `snapshot:${key}`);
  if (candidates.length === 0) {
    fail(`Could not resolve ${name}@${reference} to a pnpm lockfile snapshot.`);
  }
  return candidates;
}

function resolveImporterLink(importer, reference) {
  const relativeTarget = reference.slice('link:'.length);
  const importerDirectory = importer === '.' ? '.' : importer;
  const target = path.posix.normalize(path.posix.join(importerDirectory, relativeTarget));
  return target.length === 0 ? '.' : target;
}

function buildReachabilityGraph(lockfile) {
  const { importerDependencies, snapshotDependencies } = parsePnpmLockfile(lockfile);
  const graph = new Map();
  for (const importer of importerDependencies.keys()) graph.set(`importer:${importer}`, new Set());
  for (const snapshot of snapshotDependencies.keys()) graph.set(`snapshot:${snapshot}`, new Set());

  for (const [importer, dependencies] of importerDependencies) {
    const edges = graph.get(`importer:${importer}`);
    for (const { name, reference } of dependencies) {
      if (reference.startsWith('link:')) {
        const linkedImporter = resolveImporterLink(importer, reference);
        if (!importerDependencies.has(linkedImporter)) {
          fail(`Could not resolve workspace link ${reference} from ${importer}.`);
        }
        edges.add(`importer:${linkedImporter}`);
      } else {
        for (const target of resolveSnapshotNodes(snapshotDependencies, name, reference)) {
          edges.add(target);
        }
      }
    }
  }

  for (const [snapshot, dependencies] of snapshotDependencies) {
    const edges = graph.get(`snapshot:${snapshot}`);
    for (const { name, reference } of dependencies) {
      if (reference.startsWith('link:')) {
        fail(`Snapshot ${snapshot} contains an unsupported workspace link.`);
      }
      for (const target of resolveSnapshotNodes(snapshotDependencies, name, reference)) {
        edges.add(target);
      }
    }
  }
  return { graph, importerDependencies, snapshotDependencies };
}

function canReach(graph, start, targets) {
  const pending = [start];
  const visited = new Set();
  while (pending.length > 0) {
    const node = pending.pop();
    if (targets.has(node)) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    pending.push(...(graph.get(node) ?? []));
  }
  return false;
}

function validateImageSizeReachability(rawLockfile) {
  const { graph, importerDependencies, snapshotDependencies } = buildReachabilityGraph(rawLockfile);
  const vulnerableSnapshots = new Set(
    [...snapshotDependencies.keys()]
      .filter((key) => {
        const identity = packageIdentity(key);
        return identity.name === 'image-size' && identity.version === '1.2.1';
      })
      .map((key) => `snapshot:${key}`),
  );
  if (vulnerableSnapshots.size === 0) {
    fail('The documented image-size@1.2.1 snapshot is absent from the pnpm lockfile.');
  }

  const directParents = [];
  for (const [node, edges] of graph) {
    if ([...vulnerableSnapshots].some((target) => edges.has(target))) directParents.push(node);
  }
  if (
    directParents.length === 0 ||
    directParents.some((node) => {
      if (!node.startsWith('snapshot:')) return true;
      const identity = packageIdentity(node.slice('snapshot:'.length));
      return identity.name !== 'metro' || identity.version !== '0.84.4';
    })
  ) {
    fail('image-size@1.2.1 is not reachable exclusively through metro@0.84.4.');
  }

  const reachableImporters = [...importerDependencies.keys()].filter((importer) =>
    canReach(graph, `importer:${importer}`, vulnerableSnapshots),
  );
  if (reachableImporters.length !== 1 || reachableImporters[0] !== 'apps/mobile') {
    fail(
      `image-size@1.2.1 must be reachable only from apps/mobile; found: ${reachableImporters.join(', ') || '<none>'}.`,
    );
  }
  console.log(
    'Verified lockfile reachability: apps/mobile -> metro@0.84.4 -> image-size@1.2.1 only.',
  );
}

function validateWorkspaceAuditConfiguration(workspaceConfig) {
  for (const line of workspaceConfig.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) continue;
    if (leadingSpaces(line) !== 0) continue;
    const key = mappingEntry(line, 0)?.key;
    if (key === 'audit' || key === 'auditConfig' || key === 'ignoreGhsas') {
      fail('pnpm workspace audit-ignore configuration is prohibited.');
    }
  }
}

function parseArguments(argv) {
  const expectedNames = new Set([
    '--report',
    '--audit-exit-code',
    '--current-date',
    '--exception-record',
    '--lockfile',
    '--workspace-config',
  ]);
  const values = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!expectedNames.has(name) || value === undefined || values.has(name)) {
      fail(`Invalid dependency-audit checker arguments near ${name ?? '<missing>'}.`);
    }
    values.set(name, value);
  }
  for (const name of expectedNames) {
    if (!values.has(name)) fail(`Missing required dependency-audit checker argument ${name}.`);
  }

  const auditExitCode = Number(values.get('--audit-exit-code'));
  if (!Number.isSafeInteger(auditExitCode) || auditExitCode < 0) {
    fail('The pnpm audit exit code is invalid.');
  }

  return {
    reportPath: values.get('--report'),
    auditExitCode,
    currentDate: values.get('--current-date'),
    exceptionRecordPath: values.get('--exception-record'),
    lockfilePath: values.get('--lockfile'),
    workspaceConfigPath: values.get('--workspace-config'),
  };
}

function validateExceptionRecord(record) {
  const requiredText = [
    ...exceptionIds,
    `**Owner:** Repository owner.`,
    `**Approval date:** 2026-08-21.`,
    `**Expiry:** ${exceptionExpiry}.`,
    '**Dependency path:**',
    '**Reachability:**',
    '**Compensating controls:**',
    '**Removal trigger:**',
  ];
  for (const text of requiredText) {
    if (!record.includes(text)) {
      fail(`The dependency exception record is missing required policy text: ${text}`);
    }
  }
}

function parseReport(rawReport) {
  let report;
  try {
    report = JSON.parse(rawReport);
  } catch {
    fail('pnpm audit did not return valid JSON.');
  }
  if (!isPlainObject(report) || !isPlainObject(report.advisories)) {
    fail('pnpm audit returned an unexpected report shape.');
  }
  if (!isPlainObject(report.metadata) || !isPlainObject(report.metadata.vulnerabilities)) {
    fail('pnpm audit report metadata is missing or malformed.');
  }

  const vulnerabilityCounts = report.metadata.vulnerabilities;
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    if (!Number.isSafeInteger(vulnerabilityCounts[severity]) || vulnerabilityCounts[severity] < 0) {
      fail(`pnpm audit reported an invalid ${severity} vulnerability count.`);
    }
  }

  const advisories = Object.entries(report.advisories).map(([key, advisory]) => {
    if (!isPlainObject(advisory)) fail(`pnpm audit advisory ${key} is malformed.`);
    if (advisory.severity !== 'high' && advisory.severity !== 'critical') {
      fail(`pnpm audit advisory ${key} has an unexpected severity.`);
    }
    if (
      typeof advisory.github_advisory_id !== 'string' ||
      !/^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/u.test(
        advisory.github_advisory_id,
      )
    ) {
      fail(`pnpm audit advisory ${key} has no valid GitHub advisory ID.`);
    }
    if (typeof advisory.module_name !== 'string' || advisory.module_name.length === 0) {
      fail(`pnpm audit advisory ${key} has no valid module name.`);
    }
    if (!Array.isArray(advisory.findings) || advisory.findings.length === 0) {
      fail(`pnpm audit advisory ${key} has no findings.`);
    }
    for (const finding of advisory.findings) {
      if (
        !isPlainObject(finding) ||
        typeof finding.version !== 'string' ||
        !Array.isArray(finding.paths) ||
        finding.paths.length === 0 ||
        finding.paths.some((auditPath) => typeof auditPath !== 'string' || auditPath.length === 0)
      ) {
        fail(`pnpm audit advisory ${key} has a malformed finding.`);
      }
    }
    if (exceptionIds.has(advisory.github_advisory_id)) {
      if (advisory.module_name !== exceptionModuleName) {
        fail(
          `Approved advisory ${advisory.github_advisory_id} applies to unexpected module ${advisory.module_name}.`,
        );
      }
      for (const finding of advisory.findings) {
        if (finding.version !== exceptionVersion) {
          fail(
            `Approved advisory ${advisory.github_advisory_id} applies to unexpected ${exceptionModuleName} version ${finding.version}.`,
          );
        }
        for (const auditPath of finding.paths) {
          const segments = auditPath.split('>');
          if (
            segments[0] !== exceptionImporterPath ||
            segments.at(-2) !== 'metro' ||
            segments.at(-1) !== exceptionModuleName
          ) {
            fail(
              `Approved advisory ${advisory.github_advisory_id} has an out-of-scope dependency path: ${auditPath}.`,
            );
          }
        }
      }
    }
    return advisory;
  });

  const reportableCount = vulnerabilityCounts.high + vulnerabilityCounts.critical;
  if (reportableCount !== advisories.length) {
    fail(
      `pnpm audit metadata reports ${reportableCount} High/Critical finding(s), but ${advisories.length} advisory record(s) were returned.`,
    );
  }
  return advisories;
}

async function main() {
  const {
    reportPath,
    auditExitCode,
    currentDate,
    exceptionRecordPath,
    lockfilePath,
    workspaceConfigPath,
  } = parseArguments(process.argv.slice(2));

  for (const advisoryId of exceptionIds) {
    console.log(
      `Dependency audit exception policy: ${advisoryId} (expires ${exceptionExpiry}; record: ${exceptionRecordRelativePath})`,
    );
  }

  if (!isIsoDate(currentDate)) fail('Could not determine a valid UTC dependency-audit date.');

  let exceptionRecord;
  let rawReport;
  let rawLockfile;
  let workspaceConfig;
  try {
    [exceptionRecord, rawReport, rawLockfile, workspaceConfig] = await Promise.all([
      readFile(exceptionRecordPath, 'utf8'),
      readFile(reportPath, 'utf8'),
      readFile(lockfilePath, 'utf8'),
      readFile(workspaceConfigPath, 'utf8'),
    ]);
  } catch {
    fail(
      'The dependency audit report, lockfile, workspace config, or exception record could not be read.',
    );
  }
  validateExceptionRecord(exceptionRecord);
  validateWorkspaceAuditConfiguration(workspaceConfig);
  validateImageSizeReachability(rawLockfile);
  const advisories = parseReport(rawReport);

  const expectedAuditExitCode = advisories.length === 0 ? 0 : 1;
  if (auditExitCode !== expectedAuditExitCode) {
    fail(
      `pnpm audit exited with ${auditExitCode}; expected ${expectedAuditExitCode} for the validated report.`,
    );
  }

  const exceptionActive = currentDate < exceptionExpiry;
  if (!exceptionActive) {
    console.error(
      `Dependency audit exceptions expired on ${exceptionExpiry}; no advisory is accepted on or after this date.`,
    );
  }

  const blockedAdvisories = advisories.filter(
    (advisory) => !exceptionActive || !exceptionIds.has(advisory.github_advisory_id),
  );
  if (blockedAdvisories.length > 0) {
    for (const advisory of blockedAdvisories) {
      console.error(
        `Blocking dependency advisory: ${advisory.github_advisory_id} (${advisory.severity}).`,
      );
    }
    fail(`${blockedAdvisories.length} High/Critical dependency advisory finding(s) are blocking.`);
  }

  for (const advisory of advisories) {
    console.log(
      `Accepted temporary dependency exception: ${advisory.github_advisory_id} (${advisory.severity}; expires ${exceptionExpiry}).`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dependency-audit] ${message}`);
  process.exitCode = 1;
});
