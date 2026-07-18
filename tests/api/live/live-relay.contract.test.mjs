import assert from 'node:assert/strict';
import test from 'node:test';

import { startServer } from '../../../services/api/src/server.js';

async function postJson(runtime, pathname, body, options = {}) {
  const response = await fetch(`${runtime.baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
}

function createLiveProviderFactory(behavior = {}) {
  const state = {
    transcribeCalls: [],
    answerCalls: [],
  };

  return {
    state,
    factory: () => ({
      async transcribeAudio(args) {
        state.transcribeCalls.push(args);
        if (behavior.transcribeError) {
          throw behavior.transcribeError;
        }

        return behavior.transcribeResult ?? {
          inputTranscript: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
        };
      },
      async generateAnswer(args) {
        state.answerCalls.push(args);
        if (behavior.answerError) {
          throw behavior.answerError;
        }

        return behavior.answerResult ?? {
          answer: 'Cây dó có sợi dai và bền nên hợp với quá trình làm giấy thủ công.',
          outputTranscript: 'Cây dó có sợi dai và bền nên hợp với quá trình làm giấy thủ công.',
          audioMimeType: 'audio/wav',
          audioBase64: 'UklGRg==',
        };
      },
    }),
  };
}

test('test_live_route_rejects_invalid_payloads_before_provider_calls', async (t) => {
  const live = createLiveProviderFactory();
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const invalidCases = [
    {
      body: { sceneId: 'tay-ho-giay-do-room-01' },
      code: 'LIVE_QA_INPUT_REQUIRED',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        text: 'xin chào',
        audio: {
          mimeType: 'audio/webm',
          dataBase64: 'YQ==',
          durationMs: 1000,
        },
      },
      code: 'LIVE_QA_INPUT_CONFLICT',
    },
    {
      body: { sceneId: 'tay-ho-giay-do-room-01', text: '   ' },
      code: 'LIVE_QA_TEXT_REQUIRED',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        audio: {
          mimeType: 'audio/ogg',
          dataBase64: 'YQ==',
          durationMs: 1000,
        },
      },
      code: 'LIVE_QA_AUDIO_MIME_UNSUPPORTED',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        audio: {
          mimeType: 'audio/webm',
          dataBase64: '***',
          durationMs: 1000,
        },
      },
      code: 'LIVE_QA_AUDIO_BASE64_INVALID',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        audio: {
          mimeType: 'audio/webm',
          dataBase64: 'YQ==YQ==',
          durationMs: 1000,
        },
      },
      code: 'LIVE_QA_AUDIO_BASE64_INVALID',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        audio: {
          mimeType: 'audio/webm',
          dataBase64: Buffer.alloc(5_000_001, 1).toString('base64'),
          durationMs: 1000,
        },
      },
      code: 'LIVE_QA_AUDIO_TOO_LARGE',
    },
    {
      body: {
        sceneId: 'tay-ho-giay-do-room-01',
        audio: {
          mimeType: 'audio/webm',
          dataBase64: 'YQ==',
          durationMs: 30001,
        },
      },
      code: 'LIVE_QA_AUDIO_DURATION_INVALID',
    },
  ];

  for (const invalidCase of invalidCases) {
    const { status, payload } = await postJson(runtime, '/api/qa/live', invalidCase.body);
    assert.equal(status, 400);
    assert.equal(payload.error.code, invalidCase.code);
    assert.equal(typeof payload.error.message, 'string');
    assert.equal(typeof payload.error.retryable, 'boolean');
    assert.equal(typeof payload.error.traceId, 'string');
  }

  assert.equal(live.state.transcribeCalls.length, 0);
  assert.equal(live.state.answerCalls.length, 0);
});

test('test_live_route_accepts_media_recorder_mime_with_codecs', async (t) => {
  const live = createLiveProviderFactory({
    transcribeResult: {
      inputTranscript: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    },
  });
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    audio: {
      mimeType: 'audio/webm;codecs=opus',
      dataBase64: Buffer.from('voice').toString('base64'),
      durationMs: 1200,
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.live, true);
  assert.equal(live.state.transcribeCalls[0].audio.mimeType, 'audio/webm;codecs=opus');
});

test('test_live_route_rejects_oversized_transport_before_provider', async (t) => {
  const live = createLiveProviderFactory();
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const hugeText = 'x'.repeat(8_100_000);
  const response = await fetch(`${runtime.baseUrl}/api/qa/live`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sceneId: 'tay-ho-giay-do-room-01',
      text: hugeText,
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 413);
  assert.equal(payload.error.code, 'LIVE_QA_REQUEST_TOO_LARGE');
  assert.equal(live.state.transcribeCalls.length, 0);
  assert.equal(live.state.answerCalls.length, 0);
});

test('test_live_boundary_questions_return_natural_uncited_response', async (t) => {
  const live = createLiveProviderFactory({
    answerResult: {
      answer: 'Tư liệu của phòng trưng bày hiện chưa xác nhận giờ mở cửa.',
      outputTranscript: 'Tư liệu của phòng trưng bày hiện chưa xác nhận giờ mở cửa.',
      audioMimeType: 'audio/wav',
      audioBase64: 'UklGRg==',
    },
  });
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    text: 'Bảo tàng này mở cửa đến mấy giờ tối?',
  });

  assert.equal(status, 200);
  assert.equal(payload.live, true);
  assert.equal(payload.abstained, false);
  assert.equal(payload.confidence, 'low');
  assert.deepEqual(payload.citations, []);
  assert.equal(live.state.answerCalls.length, 1);
  assert.equal(live.state.answerCalls[0].policy, 'boundary');
});

test('test_live_health_capability_tracks_enable_flag', async (t) => {
  const disabled = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '0',
    },
  });
  const enabled = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
  });

  t.after(async () => {
    await Promise.all([disabled.stop(), enabled.stop()]);
  });

  const [disabledHealth, enabledHealth] = await Promise.all([
    fetch(`${disabled.baseUrl}/api/health`).then((response) => response.json()),
    fetch(`${enabled.baseUrl}/api/health`).then((response) => response.json()),
  ]);

  assert.equal(disabledHealth.capabilities.qaLiveVoice.enabled, false);
  assert.equal(enabledHealth.capabilities.qaLiveVoice.enabled, true);
  assert.equal(enabledHealth.capabilities.qaLiveVoice.model, 'gemini-3.1-flash-live-preview');
});

test('test_live_typed_failure_falls_back_to_rest_qa_and_tts', async (t) => {
  const live = createLiveProviderFactory({
    answerError: new Error('upstream failed'),
  });
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    text: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
  });

  assert.equal(status, 200);
  assert.equal(payload.live, false);
  assert.equal(payload.inputTranscript, 'Cây dó được dùng để làm giấy vì đặc tính gì?');
  assert.equal(payload.citations[0].ref, 'content/approved/chunks/hotspot-01.json');
  assert.equal(payload.audioMimeType, 'audio/wav');
  assert.match(payload.audioBase64, /^[A-Za-z0-9+/=]+$/);
  assert.equal(live.state.transcribeCalls.length, 0);
  assert.equal(live.state.answerCalls.length, 1);
});

test('test_live_audio_failure_before_transcript_returns_structured_recovery', async (t) => {
  const live = createLiveProviderFactory({
    transcribeError: new Error('transcription failed'),
  });
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    audio: {
      mimeType: 'audio/webm',
      dataBase64: Buffer.from('voice').toString('base64'),
      durationMs: 1200,
    },
  });

  assert.equal(status, 502);
  assert.equal(payload.error.code, 'LIVE_QA_TRANSCRIPTION_FAILED');
  assert.equal(live.state.transcribeCalls.length, 1);
  assert.equal(live.state.answerCalls.length, 0);
});

test('test_live_audio_answer_failure_falls_back_using_transcript', async (t) => {
  const live = createLiveProviderFactory({
    transcribeResult: {
      inputTranscript: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    },
    answerError: new Error('answer failed'),
  });
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    audio: {
      mimeType: 'audio/webm',
      dataBase64: Buffer.from('voice').toString('base64'),
      durationMs: 1200,
    },
  });

  assert.equal(status, 200);
  assert.equal(payload.live, false);
  assert.equal(payload.inputTranscript, 'Cây dó được dùng để làm giấy vì đặc tính gì?');
  assert.equal(payload.citations[0].ref, 'content/approved/chunks/hotspot-01.json');
  assert.equal(live.state.transcribeCalls.length, 1);
  assert.equal(live.state.answerCalls.length, 1);
});

test('test_live_route_timeout_aborts_before_rest_fallback', async (t) => {
  const state = {
    answerCalls: [],
  };
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
      GEMINI_LIVE_ROUTE_TIMEOUT_MS: '5',
    },
    liveProviderFactory: () => ({
      async transcribeAudio() {
        throw new Error('should not be called');
      },
      async generateAnswer(args) {
        state.answerCalls.push(args);
        await new Promise(() => {});
      },
    }),
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    text: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
  });

  assert.equal(status, 499);
  assert.equal(payload.error.code, 'LIVE_QA_ABORTED');
  assert.equal(payload.error.retryable, true);
});

test('test_live_success_keeps_answer_transcript_and_citations_aligned', async (t) => {
  const live = createLiveProviderFactory();
  const runtime = await startServer({
    host: '127.0.0.1',
    port: 0,
    env: {
      ...process.env,
      GEMINI_LIVE_QA_ENABLED: '1',
    },
    liveProviderFactory: live.factory,
  });

  t.after(async () => {
    await runtime.stop();
  });

  const { status, payload } = await postJson(runtime, '/api/qa/live', {
    sceneId: 'tay-ho-giay-do-room-01',
    text: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
  });

  assert.equal(status, 200);
  assert.equal(payload.live, true);
  assert.equal(payload.inputTranscript, 'Cây dó được dùng để làm giấy vì đặc tính gì?');
  assert.equal(payload.answer, payload.outputTranscript);
  assert.equal(payload.citations[0].ref, 'content/approved/chunks/hotspot-01.json');
  assert.equal(payload.audioMimeType, 'audio/wav');
  assert.equal(live.state.answerCalls.length, 1);
  assert.deepEqual(Object.keys(live.state.answerCalls[0]).sort(), [
    'chunks',
    'inputTranscript',
    'policy',
    'question',
    'sceneSummary',
    'sceneTitle',
    'signal',
  ]);
});
