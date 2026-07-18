import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function checkSyntax(filePath) {
  await run('node', ['--check', fileURLToPath(filePath)]);
}

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.type, 'module');
assert.equal(manifest.scripts.run, 'node ./scripts/run.mjs');
assert.equal(manifest.scripts.test, 'node --test tests/bootstrap/*.test.mjs');
assert.equal(manifest.scripts.lint, 'node ./scripts/lint.mjs');
assert.equal(manifest.scripts.typecheck, 'node ./scripts/typecheck.mjs');
assert.equal(manifest.scripts.build, 'node ./scripts/build.mjs');

await Promise.all([
  checkSyntax(new URL('../apps/web/src/avatar/manifest.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/avatar/runtime.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/avatar/state.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/main.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/qa/panel.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/scene/app.js', import.meta.url)),
  checkSyntax(new URL('../apps/web/src/tts/panel.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/http/errors.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/providers/mock-speech.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/qa/index.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/server.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/tts/index.js', import.meta.url)),
  checkSyntax(new URL('../services/api/src/tour/index.js', import.meta.url)),
  checkSyntax(new URL('../tests/bootstrap/health-endpoint-smoke.test.mjs', import.meta.url)),
  checkSyntax(new URL('../tests/bootstrap/vite-build-output.contract.test.mjs', import.meta.url)),
  checkSyntax(new URL('../tests/e2e/browser-bootstrap-smoke.test.mjs', import.meta.url)),
  checkSyntax(new URL('./build.mjs', import.meta.url)),
  checkSyntax(new URL('./run.mjs', import.meta.url)),
  checkSyntax(new URL('./typecheck.mjs', import.meta.url)),
]);
