import assert from 'node:assert/strict';
import test from 'node:test';

import { readLiveCapability, submitQuestionTurn } from '../../apps/web/src/qa/live-client.js';

test('test_live_capability_disabled_skips_live_call', async () => {
  const calls = [];
  const capability = await readLiveCapability(async () => ({
    ok: true,
    capabilities: {
      qaLiveVoice: {
        enabled: false,
        model: 'gemini-3.1-flash-live-preview',
      },
    },
  }));

  const result = await submitQuestionTurn({
    sceneId: 'tay-ho-giay-do-room-01',
    capability,
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    postJson: async (url) => {
      calls.push(url);
      if (url === '/api/qa') {
        return {
          answer: 'Cây dó có sợi dai và bền.',
          citations: [{ label: 'Nguồn 1', ref: 'content/approved/chunks/hotspot-01.json' }],
          confidence: 'high',
          abstained: false,
          abstainReason: null,
        };
      }

      if (url === '/api/tts') {
        return {
          transcript: 'Cây dó có sợi dai và bền.',
          audioUrl: 'data:audio/wav;base64,UklGRg==',
        };
      }

      throw new Error(`unexpected ${url}`);
    },
  });

  assert.deepEqual(calls, ['/api/qa', '/api/tts']);
  assert.equal(result.liveAttempted, false);
  assert.equal(result.ttsState.outputTranscript, 'Cây dó có sợi dai và bền.');
});

test('test_one_failed_live_attempt_falls_back_once_per_turn', async () => {
  const calls = [];

  const result = await submitQuestionTurn({
    sceneId: 'tay-ho-giay-do-room-01',
    capability: {
      enabled: true,
      model: 'gemini-3.1-flash-live-preview',
    },
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    postJson: async (url) => {
      calls.push(url);
      if (url === '/api/qa/live') {
        throw new Error('503');
      }

      if (url === '/api/qa') {
        return {
          answer: 'Cây dó có sợi dai và bền.',
          citations: [{ label: 'Nguồn 1', ref: 'content/approved/chunks/hotspot-01.json' }],
          confidence: 'high',
          abstained: false,
          abstainReason: null,
        };
      }

      if (url === '/api/tts') {
        return {
          transcript: 'Cây dó có sợi dai và bền.',
          audioUrl: 'data:audio/wav;base64,UklGRg==',
        };
      }

      throw new Error(`unexpected ${url}`);
    },
  });

  assert.deepEqual(calls, ['/api/qa/live', '/api/qa', '/api/tts']);
  assert.equal(result.liveAttempted, true);
  assert.equal(result.liveUsed, false);
  assert.match(result.ttsState.recoveryMessage, /fallback/i);
});

test('test_rest_fallback_preserves_answer_when_tts_fails', async () => {
  const calls = [];

  const result = await submitQuestionTurn({
    sceneId: 'tay-ho-giay-do-room-01',
    capability: {
      enabled: false,
      model: 'gemini-3.1-flash-live-preview',
    },
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    postJson: async (url) => {
      calls.push(url);
      if (url === '/api/qa') {
        return {
          answer: 'Cây dó có sợi dai và bền.',
          citations: [{ label: 'Nguồn 1', ref: 'content/approved/chunks/hotspot-01.json' }],
          confidence: 'high',
          abstained: false,
          abstainReason: null,
        };
      }

      if (url === '/api/tts') {
        throw new Error('TTS unavailable');
      }

      throw new Error(`unexpected ${url}`);
    },
  });

  assert.deepEqual(calls, ['/api/qa', '/api/tts']);
  assert.equal(result.qaPacket.answer, 'Cây dó có sợi dai và bền.');
  assert.equal(result.ttsState.audioUrl, '');
  assert.equal(result.ttsState.outputTranscript, 'Cây dó có sợi dai và bền.');
  assert.equal(result.ttsState.errorMessage, 'TTS unavailable');
});
