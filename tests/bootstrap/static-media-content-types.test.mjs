import assert from 'node:assert/strict';
import test from 'node:test';

import { startServer } from '../../services/api/src/server.js';

test('test_static_media_content_types', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const [fbxResponse, mp4Response] = await Promise.all([
    fetch(`${runtime.baseUrl}/guide_girl/Idle.fbx`),
    fetch(`${runtime.baseUrl}/making_step/Buoc1_nau_do.mp4`),
  ]);

  assert.equal(fbxResponse.status, 200);
  assert.equal(fbxResponse.headers.get('content-type'), 'application/octet-stream');

  assert.equal(mp4Response.status, 200);
  assert.equal(mp4Response.headers.get('content-type'), 'video/mp4');
});
