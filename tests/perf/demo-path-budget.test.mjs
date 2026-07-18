import assert from 'node:assert/strict';
import test from 'node:test';

import { answerQuestion } from '../../services/api/src/qa/index.js';
import { getSceneConfig } from '../../services/api/src/scene/index.js';
import { synthesizeSpeech } from '../../services/api/src/tts/index.js';
import { getTourConfig } from '../../services/api/src/tour/index.js';

test('test_demo_path_long_tasks_under_budget', async () => {
  const startedAt = performance.now();
  const [scene, tour, qaPacket] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
    answerQuestion({
      sceneId: 'tay-ho-giay-do-room-01',
      question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    }),
  ]);
  await synthesizeSpeech({ text: qaPacket.answer, voice: 'mock-default' });
  const elapsed = performance.now() - startedAt;

  assert.equal(scene.sceneId, 'tay-ho-giay-do-room-01');
  assert.equal(tour.tourId, 'tour-01');
  assert.ok(elapsed < 50, `demo-critical local path exceeded 50ms: ${elapsed.toFixed(2)}ms`);
});
