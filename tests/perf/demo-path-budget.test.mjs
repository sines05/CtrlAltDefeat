import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getMediaManifest } from '../../services/api/src/media/index.js';
import { answerQuestion } from '../../services/api/src/qa/index.js';
import { getSceneConfig } from '../../services/api/src/scene/index.js';
import { synthesizeSpeech } from '../../services/api/src/tts/index.js';
import { getTourConfig } from '../../services/api/src/tour/index.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

test('test_demo_path_long_tasks_returns_complete_data', async () => {
  const [scene, tour, qaPacket] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
    answerQuestion({
      sceneId: 'tay-ho-giay-do-room-01',
      question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    }),
  ]);
  await synthesizeSpeech({ text: qaPacket.answer, voice: 'mock-default' });
  assert.equal(scene.sceneId, 'tay-ho-giay-do-room-01');
  assert.equal(tour.tourId, 'tour-01');
  assert.ok(qaPacket.answer.length > 0);
});

test('test_media_bootstrap_keeps_manifest_metadata_only_and_scopes_eager_to_guides', async () => {
  const [manifest, mainSource, landingSource] = await Promise.all([
    getMediaManifest('tay-ho-giay-do-room-01'),
    readFile(path.join(repoRoot, 'apps/web/src/main.js'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/landing.js'), 'utf8'),
  ]);
  const serializedManifest = JSON.stringify(manifest);
  const eagerAssetIds = manifest.assets
    .filter((asset) => asset.preload === 'eager')
    .map((asset) => asset.assetId)
    .sort();

  assert.deepEqual(eagerAssetIds, ['guide-idle', 'guide-model', 'guide-talk', 'guide-walk']);
  assert.ok(manifest.assets.every((asset) => (
    eagerAssetIds.includes(asset.assetId)
      ? asset.preload === 'eager'
      : asset.preload === 'none'
  )));
  assert.doesNotMatch(serializedManifest, /(?:data:|base64)/iu);
  assert.match(mainSource, /const LANDING_PRELOAD_GUIDE_ROLES = \['guide-model', 'guide-idle'\];/u);
  assert.match(landingSource, /connection\?\.saveData/u);
  assert.match(landingSource, /connection\?\.effectiveType === '4g'/u);
  assert.match(landingSource, /Number\.isFinite\(navigator\.deviceMemory\) && navigator\.deviceMemory >= 4/u);
  assert.match(landingSource, /window\.innerWidth >= 1024/u);
  assert.doesNotMatch(mainSource, /stations\.forEach\(station => \{\n\s+station\.videoDisplay\.load\(\);/u);
  assert.doesNotMatch(mainSource, /Promise\.all\(\[\n\s+loadWithLog\(modelPath,/u);
  assert.doesNotMatch(landingSource, /assets\.map\([^)]*load/u);
});
