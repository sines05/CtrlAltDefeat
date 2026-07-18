import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readDocument(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

test('test_media_docs_describe_the_shipped_manifest_runtime_without_scope_creep', async () => {
  const [architecture, standards, apiContract] = await Promise.all([
    readDocument('docs/system-architecture.md'),
    readDocument('docs/code-standards.md'),
    readDocument('docs/engineering/api-contract.md'),
  ]);

  assert.match(architecture, /\/api\/media\/\{sceneId\}/u);
  assert.match(architecture, /Vite/u);
  assert.match(standards, /content\/approved\/media/u);
  assert.match(apiContract, /GET \/api\/media\/\{sceneId\}/u);
  assert.match(apiContract, /MEDIA_MANIFEST_NOT_FOUND/u);
  assert.doesNotMatch(`${architecture}\n${standards}`, /chưa có (?:ứng dụng chạy thực tế|app code)/iu);
  assert.doesNotMatch(`${architecture}\n${standards}\n${apiContract}`, /\b(?:CMS|upload|CDN)\b/iu);
});
