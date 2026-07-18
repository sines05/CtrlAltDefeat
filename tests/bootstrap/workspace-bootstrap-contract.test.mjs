import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const contents = await readFile(absolutePath, 'utf8');
  return JSON.parse(contents);
}

test('test_workspace_bootstrap_contract', async () => {
  const manifest = await readJson('package.json');

  assert.equal(manifest.private, true);
  assert.equal(manifest.packageManager, 'npm@11.16.0');
  assert.deepEqual(
    Object.keys(manifest.scripts).sort(),
    ['build', 'lint', 'run', 'test', 'typecheck'],
  );
  assert.equal(manifest.scripts.run, 'node ./scripts/run.mjs');
  assert.equal(manifest.scripts.test, 'node --test tests/bootstrap/*.test.mjs');
  assert.equal(manifest.scripts.lint, 'node ./scripts/lint.mjs');
  assert.equal(manifest.scripts.typecheck, 'node ./scripts/typecheck.mjs');
  assert.equal(manifest.scripts.build, 'node ./scripts/build.mjs');

  for (const relativePath of [
    'apps/web/index.html',
    'apps/web/src/main.js',
    'services/api/src/server.js',
    'services/api/src/http/errors.js',
    'services/api/src/media/index.js',
    'content/approved/media/tay-ho-giay-do-room-01.json',
  ]) {
    const absolutePath = path.join(repoRoot, relativePath);
    await readFile(absolutePath, 'utf8');
  }
});
