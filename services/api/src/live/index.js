import { createErrorResponse } from '../http/errors.js';
import {
  GEMINI_LIVE_MODEL,
  answerWithGeminiLive,
  transcribeWithGeminiLive,
} from '../providers/gemini-live.js';
import { answerQuestion, resolveGroundingContext } from '../qa/index.js';
import { synthesizeSpeech } from '../tts/index.js';

const AUDIO_MIME_TYPES = new Set(['audio/webm', 'audio/mp4', 'audio/wav']);
const MAX_AUDIO_BYTES = 5_000_000;
const MAX_AUDIO_DURATION_MS = 30_000;

function liveModelName() {
  return GEMINI_LIVE_MODEL.replace(/^models\//, '');
}

function normalizeAudioMimeType(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeBase64(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

function decodeBase64(value) {
  const normalized = normalizeBase64(value);

  if (!normalized || normalized.length % 4 !== 0) {
    return null;
  }

  const bytes = Buffer.from(normalized, 'base64');
  if (!bytes.length || bytes.toString('base64') !== normalized) {
    return null;
  }

  return {
    bytes,
    dataBase64: normalized,
  };
}

function createValidationError(code, message) {
  return {
    status: 400,
    body: createErrorResponse(code, message, false),
  };
}

function normalizeCanonicalText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\p{P}\p{S}]+$/u, '')
    .trim();
}

function deriveConfidence(selectedChunks) {
  return selectedChunks.length > 1 ? 'medium' : 'high';
}

function parseAudioDataUrl(audioUrl) {
  const match = String(audioUrl ?? '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return {
      audioMimeType: null,
      audioBase64: null,
    };
  }

  return {
    audioMimeType: match[1],
    audioBase64: match[2],
  };
}

function createAbortError(signal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new Error('Live request aborted.');
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError(signal);
  }
}

function runAbortable(operation, signal) {
  throwIfAborted(signal);

  if (!signal) {
    return operation();
  }

  return Promise.race([
    operation(),
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(createAbortError(signal)), { once: true });
    }),
  ]);
}

export function isLiveQaEnabled(env = process.env) {
  return env.GEMINI_LIVE_QA_ENABLED === '1';
}

export function getLiveQaCapability(env = process.env) {
  return {
    enabled: isLiveQaEnabled(env),
    model: liveModelName(),
  };
}

function validateLivePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return createValidationError('LIVE_QA_BODY_INVALID', 'Request body must be a JSON object.');
  }

  if (typeof payload.sceneId !== 'string' || !payload.sceneId.trim()) {
    return createValidationError('LIVE_QA_SCENE_REQUIRED', 'sceneId is required.');
  }

  const hasText = Object.prototype.hasOwnProperty.call(payload, 'text');
  const hasAudio = Object.prototype.hasOwnProperty.call(payload, 'audio');

  if (hasText && hasAudio) {
    return createValidationError('LIVE_QA_INPUT_CONFLICT', 'Provide exactly one of text or audio.');
  }

  if (!hasText && !hasAudio) {
    return createValidationError('LIVE_QA_INPUT_REQUIRED', 'Provide text or audio.');
  }

  if (hasText) {
    const text = String(payload.text ?? '').trim();
    if (!text) {
      return createValidationError('LIVE_QA_TEXT_REQUIRED', 'text must be a non-empty string.');
    }

    return {
      sceneId: payload.sceneId.trim(),
      text,
      audio: null,
    };
  }

  if (!payload.audio || typeof payload.audio !== 'object' || Array.isArray(payload.audio)) {
    return createValidationError('LIVE_QA_AUDIO_REQUIRED', 'audio must be an object.');
  }

  const mimeType = normalizeAudioMimeType(payload.audio.mimeType);
  const baseMimeType = mimeType.split(';', 1)[0];
  if (!AUDIO_MIME_TYPES.has(baseMimeType)) {
    return createValidationError('LIVE_QA_AUDIO_MIME_UNSUPPORTED', 'audio.mimeType is not supported.');
  }

  const decodedAudio = decodeBase64(payload.audio.dataBase64);
  if (!decodedAudio) {
    return createValidationError('LIVE_QA_AUDIO_BASE64_INVALID', 'audio.dataBase64 must be valid base64 audio bytes.');
  }

  if (decodedAudio.bytes.length > MAX_AUDIO_BYTES) {
    return createValidationError('LIVE_QA_AUDIO_TOO_LARGE', 'audio payload exceeds the 5 MB limit.');
  }

  const durationMs = Number(payload.audio.durationMs);
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > MAX_AUDIO_DURATION_MS) {
    return createValidationError('LIVE_QA_AUDIO_DURATION_INVALID', 'audio.durationMs must be an integer between 1 and 30000.');
  }

  return {
    sceneId: payload.sceneId.trim(),
    text: null,
    audio: {
      mimeType,
      dataBase64: decodedAudio.dataBase64,
      durationMs,
      byteLength: decodedAudio.bytes.length,
    },
  };
}

function createProvider(env, liveProviderFactory) {
  if (liveProviderFactory) {
    return liveProviderFactory();
  }

  return {
    transcribeAudio: (args) => transcribeWithGeminiLive({ ...args, env }),
    generateAnswer: (args) => answerWithGeminiLive({ ...args, env }),
  };
}

async function buildRestFallback({ sceneId, inputTranscript, signal }) {
  throwIfAborted(signal);

  const qaPacket = await runAbortable(() => answerQuestion({
    sceneId,
    question: inputTranscript,
  }), signal);

  throwIfAborted(signal);

  if (qaPacket.abstained) {
    return {
      status: 200,
      body: {
        ...qaPacket,
        inputTranscript,
        outputTranscript: qaPacket.answer,
        audioMimeType: null,
        audioBase64: null,
        live: false,
      },
    };
  }

  try {
    const ttsPacket = await runAbortable(() => synthesizeSpeech({
      text: qaPacket.answer,
      voice: 'mock-default',
    }), signal);
    const { audioMimeType, audioBase64 } = parseAudioDataUrl(ttsPacket.audioUrl);

    return {
      status: 200,
      body: {
        ...qaPacket,
        inputTranscript,
        outputTranscript: ttsPacket.transcript,
        audioMimeType,
        audioBase64,
        live: false,
      },
    };
  } catch (error) {
    return {
      status: 200,
      body: {
        ...qaPacket,
        inputTranscript,
        outputTranscript: qaPacket.answer,
        audioMimeType: null,
        audioBase64: null,
        live: false,
        ttsError: error instanceof Error ? error.message : 'TTS unavailable',
      },
    };
  }
}

async function buildLiveSuccess({ sceneId, inputTranscript, provider, signal }) {
  throwIfAborted(signal);

  const grounding = await resolveGroundingContext({
    sceneId,
    question: inputTranscript,
  });

  if (grounding.abort) {
    return buildRestFallback({ sceneId, inputTranscript, signal });
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let livePacket;

    try {
      livePacket = await runAbortable(() => provider.generateAnswer({
        inputTranscript,
        question: grounding.exactExample?.question ?? grounding.question,
        sceneTitle: grounding.source.title,
        sceneSummary: grounding.source.summary,
        chunks: grounding.selectedChunks,
        policy: grounding.policy,
        signal,
      }), signal);
    } catch {
      throwIfAborted(signal);
      return buildRestFallback({ sceneId, inputTranscript, signal });
    }

    if (normalizeCanonicalText(livePacket.answer) !== normalizeCanonicalText(livePacket.outputTranscript)) {
      if (attempt === 0) {
        continue;
      }

      throwIfAborted(signal);
      return buildRestFallback({ sceneId, inputTranscript, signal });
    }

    return {
      status: 200,
      body: {
        answer: livePacket.answer,
        citations: grounding.citations,
        confidence: ['conversation', 'boundary'].includes(grounding.policy)
          ? 'low'
          : deriveConfidence(grounding.selectedChunks),
        abstained: false,
        abstainReason: null,
        inputTranscript,
        outputTranscript: livePacket.outputTranscript,
        audioMimeType: livePacket.audioMimeType,
        audioBase64: livePacket.audioBase64,
        traceId: grounding.traceId,
        live: true,
      },
    };
  }

  return buildRestFallback({ sceneId, inputTranscript, signal });
}

export async function answerLiveQuestion({ payload, env = process.env, signal, liveProviderFactory } = {}) {
  if (!isLiveQaEnabled(env)) {
    return {
      status: 503,
      body: createErrorResponse('LIVE_QA_DISABLED', 'Gemini Live QA is disabled.', false),
    };
  }

  const parsed = validateLivePayload(payload);
  if (parsed?.status) {
    return parsed;
  }

  const provider = createProvider(env, liveProviderFactory);

  if (parsed.text) {
    return buildLiveSuccess({
      sceneId: parsed.sceneId,
      inputTranscript: parsed.text,
      provider,
      signal,
    });
  }

  let inputTranscript = '';

  try {
    const transcriptPacket = await runAbortable(() => provider.transcribeAudio({
      audio: parsed.audio,
      signal,
    }), signal);
    inputTranscript = String(transcriptPacket?.inputTranscript ?? '').trim();
  } catch {
    throwIfAborted(signal);
    return {
      status: 502,
      body: createErrorResponse('LIVE_QA_TRANSCRIPTION_FAILED', 'Audio transcription failed before a grounded answer was available.', true),
    };
  }

  if (!inputTranscript) {
    return {
      status: 502,
      body: createErrorResponse('LIVE_QA_TRANSCRIPTION_FAILED', 'Audio transcription returned no usable transcript.', true),
    };
  }

  return buildLiveSuccess({
    sceneId: parsed.sceneId,
    inputTranscript,
    provider,
    signal,
  });
}
