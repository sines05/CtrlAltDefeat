import assert from 'node:assert/strict';
import test from 'node:test';

import { startServer } from '../../services/api/src/server.js';

test('test_health_endpoint_smoke', async (t) => {
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '0',
    },
  });

  t.after(async () => {
    await runtime.stop();
  });

  const [
    healthResponse,
    rootResponse,
    scriptResponse,
    sceneResponse,
    cesiumAssetResponse,
    huongDanVienAssetResponse,
  ] = await Promise.all([
    fetch(`${runtime.baseUrl}/api/health`),
    fetch(`${runtime.baseUrl}/`),
    fetch(`${runtime.baseUrl}/src/main.js`),
    fetch(`${runtime.baseUrl}/api/scene/tay-ho-giay-do-room-01`),
    fetch(`${runtime.baseUrl}/assets/avatar/cesium-man.glb`),
    fetch(`${runtime.baseUrl}/assets/avatar/huongdanvien.glb`),
  ]);

  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    capabilities: {
      qaLiveVoice: {
        enabled: false,
        model: 'gemini-3.1-flash-live-preview',
      },
    },
  });

  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await rootResponse.text(), /<script type="module" src="\/src\/main\.js"><\/script>/);

  assert.equal(scriptResponse.status, 200);
  assert.match(scriptResponse.headers.get('content-type') ?? '', /text\/javascript/);
  assert.match(await scriptResponse.text(), /createSceneAppHtml/);

  assert.equal(sceneResponse.status, 200);
  assert.equal((await sceneResponse.json()).sceneId, 'tay-ho-giay-do-room-01');

  assert.equal(cesiumAssetResponse.status, 200);
  assert.match(cesiumAssetResponse.headers.get('content-type') ?? '', /model\/gltf-binary/);
  assert.ok((await cesiumAssetResponse.arrayBuffer()).byteLength > 0);

  assert.equal(huongDanVienAssetResponse.status, 200);
  assert.match(huongDanVienAssetResponse.headers.get('content-type') ?? '', /model\/gltf-binary/);
  assert.ok((await huongDanVienAssetResponse.arrayBuffer()).byteLength > 0);
});
