import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { fetchBootstrapContent } from '../../apps/web/src/media/client.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function createFetchStub(responses, calls) {
  return async (url) => {
    calls.push(String(url));
    const response = responses.shift();

    if (response instanceof Error) {
      throw response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => response,
    };
  };
}

test('test_bootstrap_fetches_scene_then_tour_then_media', async () => {
  const calls = [];
  const mediaManifest = { sceneId: 'tay-ho-giay-do-room-01', assets: [], processStations: [] };
  const result = await fetchBootstrapContent({
    sceneId: 'tay-ho-giay-do-room-01',
    tourId: 'tour-01',
    fetchImpl: createFetchStub([
      { sceneId: 'tay-ho-giay-do-room-01' },
      { tourId: 'tour-01', steps: [] },
      mediaManifest,
    ], calls),
  });

  assert.deepEqual(calls, [
    '/api/scene/tay-ho-giay-do-room-01',
    '/api/tour/tour-01',
    '/api/media/tay-ho-giay-do-room-01',
  ]);
  assert.equal(result.scene.sceneId, 'tay-ho-giay-do-room-01');
  assert.equal(result.tour.tourId, 'tour-01');
  assert.deepEqual(result.media, mediaManifest);
  assert.equal(result.mediaError, null);
});

test('test_bootstrap_media_failure_isolated_from_scene_and_tour', async () => {
  const calls = [];
  const result = await fetchBootstrapContent({
    sceneId: 'tay-ho-giay-do-room-01',
    tourId: 'tour-01',
    fetchImpl: createFetchStub([
      { sceneId: 'tay-ho-giay-do-room-01' },
      { tourId: 'tour-01', steps: [] },
      new Error('media down'),
    ], calls),
  });

  assert.equal(calls[2], '/api/media/tay-ho-giay-do-room-01');
  assert.equal(result.media, null);
  assert.equal(result.mediaError?.message, 'media down');
  assert.equal(result.scene.sceneId, 'tay-ho-giay-do-room-01');
  assert.equal(result.tour.tourId, 'tour-01');
});

test('test_runtime_source_delegates_media_fetch_and_removes_startup_preload_loop', async () => {
  const mainSource = await readFile(path.join(repoRoot, 'apps/web/src/main.js'), 'utf8');
  const clientSource = await readFile(path.join(repoRoot, 'apps/web/src/media/client.js'), 'utf8');

  assert.match(mainSource, /fetchBootstrapContent\(/u);
  assert.match(clientSource, /\/api\/scene\/\$\{sceneId\}/u);
  assert.match(clientSource, /\/api\/tour\/\$\{tourId\}/u);
  assert.match(clientSource, /\/api\/media\/\$\{sceneId\}/u);
  assert.doesNotMatch(mainSource, /stations\.forEach\(station => \{\n\s+station\.videoDisplay\.load\(\);/u);
  assert.doesNotMatch(mainSource, /Promise\.all\(\[\n\s+loadWithLog\(modelPath,/u);
});
