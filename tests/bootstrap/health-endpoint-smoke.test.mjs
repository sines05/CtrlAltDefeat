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
    landingEntryResponse,
    sceneResponse,
    avatarReadmeResponse,
  ] = await Promise.all([
    fetch(`${runtime.baseUrl}/api/health`),
    fetch(`${runtime.baseUrl}/`),
    fetch(`${runtime.baseUrl}/src/landing.js`),
    fetch(`${runtime.baseUrl}/api/scene/tay-ho-giay-do-room-01`),
    fetch(`${runtime.baseUrl}/assets/avatar/README.md`),
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
  const rootHtml = await rootResponse.text();
  assert.match(rootHtml, /id="landing"/);
  assert.match(rootHtml, /<script type="module" src="\/src\/landing\.js"><\/script>/);
  assert.doesNotMatch(rootHtml, /<script type="module" src="\/src\/main\.js"><\/script>/);

  assert.equal(landingEntryResponse.status, 200);
  const landingEntrySource = await landingEntryResponse.text();
  assert.match(landingEntrySource, /import\('\.\/main\.js'\)/);
  assert.match(landingEntrySource, /museum\.startMuseumApp\(\)/);
  assert.match(landingEntrySource, /connection\?\.saveData/u);
  assert.match(landingEntrySource, /connection\?\.effectiveType/u);

  assert.equal(sceneResponse.status, 200);
  assert.equal((await sceneResponse.json()).sceneId, 'tay-ho-giay-do-room-01');

  assert.equal(avatarReadmeResponse.status, 200);
  assert.match(await avatarReadmeResponse.text(), /avatar/i);
});
