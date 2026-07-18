import assert from 'node:assert/strict';
import test from 'node:test';

import { getAvatarViewModel } from '../../apps/web/src/avatar/state.js';
import { createSceneAppHtml } from '../../apps/web/src/scene/app.js';
import { answerQuestion } from '../../services/api/src/qa/index.js';
import { getSceneConfig } from '../../services/api/src/scene/index.js';
import { synthesizeSpeech } from '../../services/api/src/tts/index.js';
import { getTourConfig } from '../../services/api/src/tour/index.js';

test('test_mvp_happy_path_smoke', async () => {
  const [scene, tour, qaPacket] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
    answerQuestion({
      sceneId: 'tay-ho-giay-do-room-01',
      question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    }),
  ]);
  const ttsPacket = await synthesizeSpeech({ text: qaPacket.answer, voice: 'mock-default' });
  const html = createSceneAppHtml({
    scene,
    tour,
    hasWebGL: true,
    avatar: getAvatarViewModel(),
    hasAvatarRuntime: true,
    interactionState: {
      question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
      qaPacket,
      ttsState: {
        transcript: ttsPacket.transcript,
        audioUrl: ttsPacket.audioUrl,
        errorMessage: '',
      },
    },
  });

  assert.equal(scene.hotspots.length, 5);
  assert.equal(qaPacket.abstained, false);
  assert.ok(qaPacket.citations.length >= 1);
  assert.equal(qaPacket.citations[0]?.ref, 'content/approved/chunks/hotspot-01.json');
  assert.match(ttsPacket.audioUrl, /^data:audio\/wav;base64,/);
  assert.match(html, /data-hotspot-id="hotspot-01"/);
  assert.match(html, /content\/approved\/chunks\/hotspot-01\.json/);
  assert.match(html, /Play audio/);
});

test('test_forced_2d_fallback_smoke', async () => {
  const [scene, tour] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
  ]);
  const html = createSceneAppHtml({
    scene,
    tour,
    hasWebGL: false,
    avatar: getAvatarViewModel(),
    hasAvatarRuntime: false,
    interactionState: {
      question: '',
      qaPacket: null,
      ttsState: {
        transcript: tour.steps[0].ttsText,
        audioUrl: '',
        errorMessage: '',
      },
    },
  });

  assert.match(html, /data-mode="fallback"/);
  assert.match(html, /Danh sách hotspot/);
  assert.match(html, /Tour 5 bước/);
  assert.match(html, /Transcript/);
});

test('test_qa_tts_failure_drills', async () => {
  const [scene, tour, qaPacket] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
    answerQuestion({
      sceneId: 'tay-ho-giay-do-room-01',
      question: 'Bảo tàng này mở cửa đến mấy giờ tối?',
    }),
  ]);
  const html = createSceneAppHtml({
    scene,
    tour,
    hasWebGL: true,
    avatar: {
      status: 'error',
      title: 'CesiumMan',
      fallbackLabel: 'Avatar unavailable',
    },
    hasAvatarRuntime: false,
    interactionState: {
      question: 'Bảo tàng này mở cửa đến mấy giờ tối?',
      qaPacket,
      ttsState: {
        transcript: tour.steps[0].ttsText,
        audioUrl: '',
        errorMessage: 'TTS timeout',
      },
    },
  });

  assert.equal(qaPacket.abstained, false);
  assert.deepEqual(qaPacket.citations, []);
  assert.match(qaPacket.answer, /Tư liệu|phòng trưng bày/i);
  assert.match(html, /TTS timeout/);
  assert.match(html, new RegExp(tour.steps[0].ttsText));
});
