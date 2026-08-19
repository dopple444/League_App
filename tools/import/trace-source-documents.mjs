import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const expectedPath = path.join(root, 'import/expected-sources.json');
const reportPath = path.join(root, 'import/traceability-report.json');
const defaultSourceDirectory = path.join(root, 'import/source-docs');

async function sha256(filePath) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest('hex');
}

export async function buildTraceabilityReport(sourceDirectory = defaultSourceDirectory) {
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  const sourceDirectoryPresent = existsSync(sourceDirectory);
  const sources = [];
  for (const source of expected.sources) {
    const filePath = path.join(sourceDirectory, source.filename);
    const present = sourceDirectoryPresent && existsSync(filePath);
    sources.push({
      logicalSourceId: source.logicalSourceId,
      filename: source.filename,
      mediaType: source.mediaType,
      status: present ? 'present_unreviewed' : 'absent',
      sha256: present ? await sha256(filePath) : null,
      byteSize: present ? statSync(filePath).size : null,
      mappings: [],
    });
  }
  sources.sort((left, right) => left.logicalSourceId.localeCompare(right.logicalSourceId));
  const anyPresent = sources.some((source) => source.status === 'present_unreviewed');

  return {
    schemaVersion: 1,
    sourceDirectoryPresent,
    overallStatus: anyPresent ? 'source_review_required' : 'awaiting_authorized_sources',
    sources,
    components: [
      {
        componentId: 'league_insurance_waiver',
        sourceId: 'all_team_packets_clean_form_2026',
        status: 'pending_source_review',
        contentHash: null,
        renderHash: null,
      },
      {
        componentId: 'parks_fiscal_court_waiver',
        sourceId: 'all_team_packets_clean_form_2026',
        status: 'pending_source_review',
        contentHash: null,
        renderHash: null,
      },
    ],
  };
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function run(arguments_) {
  const checkOnly = arguments_.includes('--check');
  const unknownArguments = arguments_.filter((argument) => argument !== '--check');
  if (unknownArguments.length > 0)
    throw new Error(`Unknown argument: ${unknownArguments.join(', ')}`);

  const report = await buildTraceabilityReport();
  const serialized = canonicalJson(report);
  if (checkOnly) {
    if (!existsSync(reportPath) || readFileSync(reportPath, 'utf8') !== serialized) {
      throw new Error(
        'Traceability report is stale. Run `pnpm import:trace` after reviewing source safety.',
      );
    }
    console.log(`Traceability report is current (${report.overallStatus}).`);
    return;
  }

  writeFileSync(reportPath, serialized, { encoding: 'utf8', mode: 0o644 });
  console.log(
    `Wrote metadata-only traceability report (${report.overallStatus}); source content was not copied.`,
  );
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Unknown traceability failure.');
    process.exitCode = 1;
  });
}
