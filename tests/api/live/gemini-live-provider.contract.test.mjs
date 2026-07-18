import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GEMINI_LIVE_ENDPOINT,
  GEMINI_LIVE_MODEL,
  answerWithGeminiLive,
  transcribeWithGeminiLive,
} from '../../../services/api/src/providers/gemini-live.js';

class FakeSocket {
  constructor(url, script) {
    this.url = url;
    this.script = script;
    this.sent = [];
    this.closed = [];
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send(payload) {
    const message = JSON.parse(payload);
    this.sent.push(message);
    this.script?.(this, message);
  }

  close(code = 1000, reason = 'closed') {
    this.closed.push({ code, reason });
    queueMicrotask(() => {
      this.onclose?.({ code, reason });
    });
  }
}

function createSocketFactory(script, sockets) {
  return (url) => {
    const socket = new FakeSocket(url, script);
    sockets.push(socket);
    return socket;
  };
}

test('test_transcription_session_uses_pinned_endpoint_and_model', async () => {
  const sockets = [];
  const createSocket = createSocketFactory((socket, message) => {
    if (message.setup) {
      queueMicrotask(() => {
        socket.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
      });
      return;
    }

    if (message.realtimeInput?.audioStreamEnd) {
      queueMicrotask(() => {
        socket.onmessage?.({
          data: JSON.stringify({
            serverContent: {
              inputTranscription: {
                text: 'bản ghi âm đầu vào',
              },
              turnComplete: true,
            },
          }),
        });
      });
    }
  }, sockets);

  const result = await transcribeWithGeminiLive({
    audio: {
      mimeType: 'audio/webm',
      dataBase64: Buffer.from('voice').toString('base64'),
    },
    env: { GEMINI_API_KEY: 'test-key' },
    createSocket,
  });

  assert.equal(result.inputTranscript, 'bản ghi âm đầu vào');
  assert.equal(sockets[0].url, `${GEMINI_LIVE_ENDPOINT}?key=test-key`);
  assert.equal(sockets[0].sent[0].setup.model, GEMINI_LIVE_MODEL);
  assert.equal(sockets[0].sent[1].realtimeInput.audio.mimeType, 'audio/webm');
  assert.equal(sockets[0].sent[2].realtimeInput.audioStreamEnd, true);
});

test('test_answer_session_uses_only_transcript_and_grounded_chunks', async () => {
  const sockets = [];
  const createSocket = createSocketFactory((socket, message) => {
    if (message.setup) {
      queueMicrotask(() => {
        socket.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
      });
      return;
    }

    if (message.clientContent) {
      queueMicrotask(() => {
        socket.onmessage?.({
          data: JSON.stringify({
            serverContent: {
              modelTurn: {
                role: 'model',
                parts: [
                  { text: 'Câu trả lời grounded.' },
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: 'UklGRg==',
                    },
                  },
                ],
              },
              outputTranscription: {
                text: 'Câu trả lời grounded.',
              },
              generationComplete: true,
              turnComplete: true,
            },
          }),
        });
      });
    }
  }, sockets);

  const result = await answerWithGeminiLive({
    inputTranscript: 'Cây dó được dùng để làm giấy vì đặc tính gì?',
    sceneTitle: 'Tây Hồ giấy dó',
    sceneSummary: 'Quy trình làm giấy dó.',
    chunks: [
      {
        chunkId: 'hotspot-01',
        title: 'Cây dó',
        citation: 'Nguồn 1',
        text: 'Cây dó có sợi dài và dai.',
      },
    ],
    env: { GEMINI_API_KEY: 'test-key' },
    createSocket,
  });

  const promptText = sockets[0].sent[1].clientContent.turns[0].parts[0].text;
  assert.equal(result.answer, 'Câu trả lời grounded.');
  assert.equal(result.outputTranscript, 'Câu trả lời grounded.');
  assert.equal(result.audioMimeType, 'audio/wav');
  assert.equal(result.audioBase64, 'UklGRg==');
  assert.match(promptText, /Cây dó được dùng để làm giấy/);
  assert.match(promptText, /hotspot-01/);
  assert.doesNotMatch(promptText, /rawAudio|session history|dm9pY2U=/i);
});

test('test_provider_closes_socket_on_goaway', async () => {
  const sockets = [];
  const createSocket = createSocketFactory((socket, message) => {
    if (message.setup) {
      queueMicrotask(() => {
        socket.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
      });
      return;
    }

    queueMicrotask(() => {
      socket.onmessage?.({ data: JSON.stringify({ goAway: { timeLeft: '1s' } }) });
    });
  }, sockets);

  await assert.rejects(
    answerWithGeminiLive({
      inputTranscript: 'Xin chào',
      sceneTitle: 'Tây Hồ giấy dó',
      sceneSummary: 'Quy trình làm giấy dó.',
      chunks: [],
      env: { GEMINI_API_KEY: 'test-key' },
      createSocket,
    }),
    /goAway/i,
  );

  assert.ok(sockets[0].closed.length >= 1);
});

test('test_provider_closes_socket_on_abort_timeout', async () => {
  const sockets = [];
  const createSocket = createSocketFactory((socket, message) => {
    if (message.setup) {
      queueMicrotask(() => {
        socket.onmessage?.({ data: JSON.stringify({ setupComplete: {} }) });
      });
    }
  }, sockets);

  await assert.rejects(
    transcribeWithGeminiLive({
      audio: {
        mimeType: 'audio/webm',
        dataBase64: Buffer.from('voice').toString('base64'),
      },
      env: {
        GEMINI_API_KEY: 'test-key',
        GEMINI_LIVE_UPSTREAM_TIMEOUT_MS: '5',
      },
      createSocket,
    }),
    /timeout|aborted/i,
  );

  assert.ok(sockets[0].closed.length >= 1);
});
