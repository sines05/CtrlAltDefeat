import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { startServer } from '../../../services/api/src/server.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const sceneId = 'tay-ho-giay-do-room-01';

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

test('test_media_api_returns_scene_manifest', async (t) => {
  const expected = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${runtime.baseUrl}/api/media/${sceneId}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, expected);
});

test('test_media_api_returns_existing_error_shape_for_unknown_scene', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${runtime.baseUrl}/api/media/missing-scene`);
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.error.code, 'MEDIA_MANIFEST_NOT_FOUND');
  assert.equal(payload.error.message, 'Media manifest not found.');
  assert.equal(payload.error.retryable, false);
  assert.equal(typeof payload.error.traceId, 'string');
});
