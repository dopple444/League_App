import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildTraceabilityReport } from './trace-source-documents.mjs';

describe('source traceability', () => {
  it('records absent authorized inputs without inventing hashes or waiver text', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'league-source-trace-'));
    const report = await buildTraceabilityReport(path.join(directory, 'not-present'));

    assert.equal(report.overallStatus, 'awaiting_authorized_sources');
    assert.equal(
      report.sources.every((source) => source.sha256 === null),
      true,
    );
    assert.deepEqual(
      report.components.map((component) => component.componentId),
      ['league_insurance_waiver', 'parks_fiscal_court_waiver'],
    );
  });

  it('hashes an authorized file without copying or parsing its contents', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'league-source-trace-'));
    writeFileSync(
      path.join(directory, 'Meade_County_Church_Softball_Master_2026.xlsx'),
      'synthetic fixture bytes',
    );
    const report = await buildTraceabilityReport(directory);
    const source = report.sources.find((item) => item.logicalSourceId === 'master_2026');

    assert.equal(report.overallStatus, 'source_review_required');
    assert.equal(source?.byteSize, 23);
    assert.match(source?.sha256 ?? '', /^[a-f0-9]{64}$/u);
    assert.equal(JSON.stringify(report).includes('synthetic fixture bytes'), false);
  });
});
