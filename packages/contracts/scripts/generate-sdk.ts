import { readFile, writeFile } from 'node:fs/promises';

import { openApiDocument } from '../src/openapi.js';

const openApiUrl = new URL('../../sdk/openapi.json', import.meta.url);
const clientUrl = new URL('../../sdk/src/generated/client.ts', import.meta.url);
const templateUrl = new URL('../templates/generated-client.ts', import.meta.url);

await writeFile(openApiUrl, `${JSON.stringify(openApiDocument)}\n`, 'utf8');
await writeFile(clientUrl, await readFile(templateUrl, 'utf8'), 'utf8');
