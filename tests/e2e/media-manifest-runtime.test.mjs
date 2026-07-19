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

test('test_runtime_source_keeps_guide_preload_scoped_and_promotion_staged', async () => {
  const [mainSource, clientSource] = await Promise.all([
    readFile(path.join(repoRoot, 'apps/web/src/main.js'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/media/client.js'), 'utf8'),
  ]);
  const preloadSection = mainSource.split('export async function preloadMuseumGuides() {')[1]?.split('function fadeToAction')[0] ?? '';
  const promotionSection = mainSource.split('async function promoteAnimatedCharacters')[1]?.split('function maybeLoadSceneProps')[0] ?? '';
  const promotionFrameYields = [...promotionSection.matchAll(/await waitForNextFrame\(\);/gu)].length;

  assert.match(mainSource, /fetchBootstrapContent\(/u);
  assert.match(clientSource, /\/api\/scene\/\$\{sceneId\}/u);
  assert.match(clientSource, /\/api\/tour\/\$\{tourId\}/u);
  assert.match(clientSource, /\/api\/media\/\$\{sceneId\}/u);
  assert.match(mainSource, /const SCENE_PROP_ACTIVATION_DISTANCE = 12;/u);
  assert.match(mainSource, /const GUIDE_PROMOTION_ROLES = \['guide-model', 'guide-idle', 'guide-walk', 'guide-talk'\];/u);
  assert.match(mainSource, /const LANDING_PRELOAD_GUIDE_ROLES = \['guide-model', 'guide-idle'\];/u);
  assert.match(mainSource, /function ensureGuidePromotionLoad\(\)/u);
  assert.match(mainSource, /approvedBootstrapPromise = null;\n\s+throw approvedContent\.mediaError;/u);
  assert.match(mainSource, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/u);
  assert.match(mainSource, /function resetRuntimeShell\(\)/u);
  assert.match(mainSource, /resetRuntimeShell\(\);\n\s+runtimeStartPromise = null;/u);
  assert.match(mainSource, /const nextScene = new THREE\.Scene\(\);/u);
  assert.match(mainSource, /scene = nextScene;\n\s+camera = nextCamera;\n\s+renderer = nextRenderer;/u);
  assert.match(mainSource, /Promise\.all\(GUIDE_PROMOTION_ROLES\.map\(\(role\) => modelRegistry\.loadRole\(role\)\)\)/u);
  assert.match(preloadSection, /for \(const role of LANDING_PRELOAD_GUIDE_ROLES\) \{\n\s+await modelRegistry\.loadRole\(role\);\n\s+await waitForNextFrame\(\);/u);
  assert.match(mainSource, /export function startMuseumApp\(\)/u);
  assert.doesNotMatch(mainSource, /\ninitializeBaseScene\(\);\nvoid /u);
  assert.equal(promotionFrameYields, 2);
  assert.match(promotionSection, /guideModel\.visible = false;/u);
  assert.match(promotionSection, /guideModel\.visible = true;\n\s+removeSceneObject\(previousPlayer\);\n\s+removeSceneObject\(previousGuide\);/u);
  assert.match(mainSource, /const loadPromise = modelRegistry\.loadRole\(target\.role\)/u);
  assert.match(mainSource, /if \(bootstrapState\.media\.status === 'ready' && modelRegistry\) \{\n\s+maybeLoadSceneProps\(\);/u);
  assert.doesNotMatch(mainSource, /stations\.forEach\(station => \{\n\s+station\.videoDisplay\.load\(\);/u);
  assert.doesNotMatch(mainSource, /Promise\.all\(\[\n\s+loadWithLog\(modelPath,/u);
});
