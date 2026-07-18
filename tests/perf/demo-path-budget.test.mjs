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

test('test_media_bootstrap_stays_metadata_only_and_lazy', async () => {
  const [manifest, mainSource] = await Promise.all([
    getMediaManifest('tay-ho-giay-do-room-01'),
    readFile(path.join(repoRoot, 'apps/web/src/main.js'), 'utf8'),
  ]);
  const serializedManifest = JSON.stringify(manifest);

  assert.ok(manifest.assets.every((asset) => asset.preload === 'none'));
  assert.doesNotMatch(serializedManifest, /(?:data:|base64)/iu);
  assert.doesNotMatch(mainSource, /stations\.forEach\(station => \{\n\s+station\.videoDisplay\.load\(\);/u);
  assert.doesNotMatch(mainSource, /Promise\.all\(\[\n\s+loadWithLog\(modelPath,/u);
});
