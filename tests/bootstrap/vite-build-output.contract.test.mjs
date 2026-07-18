import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const buildRoot = resolve(repoRoot, 'build');

async function expectFile(relativePath) {
  const absolutePath = resolve(buildRoot, relativePath);
  const details = await stat(absolutePath);
  assert.equal(details.isFile(), true, `${relativePath} should be a file`);
  assert.ok(details.size > 0, `${relativePath} should not be empty`);
}

test('test_vite_build_output_contract', async () => {
  await run('node', ['./scripts/build.mjs'], {
    cwd: repoRoot,
  });

  const indexHtml = await readFile(resolve(buildRoot, 'web/index.html'), 'utf8');
  const entryMatch = indexHtml.match(/<script type="module" crossorigin src="([^"]+\.js)"><\/script>/);

  assert.ok(entryMatch, 'expected Vite-built module entry in build/web/index.html');
  assert.doesNotMatch(indexHtml, /\/src\/main\.js/);

  const builtEntryPath = entryMatch[1];
  await expectFile(`web/${builtEntryPath.replace(/^\//u, '')}`);
  await expectFile('asset/mortar.fbx');
  await expectFile('guide_girl/Idle.fbx');
  await expectFile('making_step/Buoc1_nau_do.mp4');
  await expectFile('assets/avatar/README.md');
  await expectFile('manifest.json');
  await expectFile('run.mjs');
  await expectFile('api/src/server.js');
});
