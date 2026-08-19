import { readFile } from 'node:fs/promises';

import { openApiDocument } from '../src/openapi.js';

const artifactUrl = new URL('../../sdk/openapi.json', import.meta.url);
const artifact = JSON.parse(await readFile(artifactUrl, 'utf8')) as unknown;

if (JSON.stringify(artifact) !== JSON.stringify(openApiDocument)) {
  throw new Error('packages/sdk/openapi.json does not match the canonical OpenAPI document.');
}

const generatedClient = await readFile(
  new URL('../../sdk/src/generated/client.ts', import.meta.url),
  'utf8',
);
const clientTemplate = await readFile(
  new URL('../templates/generated-client.ts', import.meta.url),
  'utf8',
);
if (generatedClient !== clientTemplate) {
  throw new Error('packages/sdk/src/generated/client.ts differs from its deterministic template.');
}

const paths = (openApiDocument.paths ?? {}) as Record<string, Record<string, unknown>>;
for (const pathItem of Object.values(paths)) {
  for (const operation of Object.values(pathItem)) {
    if (operation === null || typeof operation !== 'object' || !('operationId' in operation)) {
      continue;
    }
    const operationId = (operation as { operationId: unknown }).operationId;
    if (typeof operationId === 'string' && !generatedClient.includes(`${operationId}(`)) {
      throw new Error(`Generated client is missing OpenAPI operation ${operationId}.`);
    }
  }
}
