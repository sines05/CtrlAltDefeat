import assert from 'node:assert/strict';
import test from 'node:test';

import { renderInteractionPanel } from '../../../apps/web/src/qa/panel.js';
import { startServer } from '../../../services/api/src/server.js';

async function postJson(runtime, pathname, body) {
  const response = await fetch(`${runtime.baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
}

test('test_tts_returns_audio_url_and_transcript', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/tts', {
    text: 'Điểm mở đầu của phòng giải thích vì sao cây dó được chọn làm giấy.',
    voice: 'mock-default',
  });

  assert.equal(status, 200);
  assert.match(payload.audioUrl, /^data:audio\/wav;base64,/);
  assert.equal(payload.transcript, 'Điểm mở đầu của phòng giải thích vì sao cây dó được chọn làm giấy.');
  assert.equal(typeof payload.traceId, 'string');
});

test('test_tts_failure_preserves_transcript', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const { payload: qaPacket } = await postJson(runtime, '/api/qa', {
    sceneId: 'tay-ho-giay-do-room-01',
    question: 'Sau khi xeo xong, giấy dó được ép và làm khô ra sao?',
  });

  const html = renderInteractionPanel({
    question: 'Sau khi xeo xong, giấy dó được ép và làm khô ra sao?',
    qaPacket,
    ttsState: {
      transcript: qaPacket.answer,
      audioUrl: '',
      errorMessage: 'TTS unavailable',
    },
  });

  assert.match(html, /TTS unavailable/);
  assert.match(html, new RegExp(qaPacket.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /Transcript/);
});

test('test_live_voice_panel_renders_transcripts_and_recovery_state', () => {
  const html = renderInteractionPanel({
    question: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    qaPacket: {
      answer: 'Cây dó có sợi dai và bền.',
      citations: [{ label: 'Nguồn 1', ref: 'content/approved/chunks/hotspot-01.json' }],
      confidence: 'high',
      abstained: false,
      abstainReason: null,
    },
    ttsState: {
      transcript: 'Cây dó có sợi dai và bền.',
      inputTranscript: 'câu hỏi đầu vào',
      outputTranscript: 'Cây dó có sợi dai và bền.',
      audioUrl: 'data:audio/wav;base64,UklGRg==',
      errorMessage: '',
      recoveryMessage: 'Live lỗi, đã fallback sang REST.',
    },
    liveCapability: {
      enabled: true,
      model: 'gemini-3.1-flash-live-preview',
    },
  });

  assert.match(html, /gemini-3\.1-flash-live-preview/);
  assert.match(html, /câu hỏi đầu vào/);
  assert.match(html, /Cây dó có sợi dai và bền\./);
  assert.match(html, /Live lỗi, đã fallback sang REST\./);
  assert.match(html, /data-action="record-voice"/);
});
