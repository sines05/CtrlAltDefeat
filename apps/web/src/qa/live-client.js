function escapeBase64(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

function defaultLiveCapability() {
  return {
    enabled: false,
    model: 'gemini-3.1-flash-live-preview',
  };
}

function defaultPostJson(url, body) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload?.error?.message ?? `Request failed: ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  });
}

function toAudioUrl(packet) {
  if (packet?.audioUrl) {
    return packet.audioUrl;
  }

  if (packet?.audioMimeType && packet?.audioBase64) {
    return `data:${packet.audioMimeType};base64,${escapeBase64(packet.audioBase64)}`;
  }

  return '';
}

function toTtsState(packet, { inputTranscript = '', outputTranscript = '', recoveryMessage = '' } = {}) {
  return {
    inputTranscript,
    outputTranscript,
    transcript: packet?.transcript ?? outputTranscript ?? packet?.answer ?? '',
    audioUrl: toAudioUrl(packet),
    errorMessage: '',
    recoveryMessage,
  };
}

function toAudioRecoveryState(recoveryMessage, errorMessage = '') {
  return {
    inputTranscript: '',
    outputTranscript: '',
    transcript: '',
    audioUrl: '',
    errorMessage,
    recoveryMessage,
  };
}

async function restFallback({ sceneId, question, postJson }) {
  const qaPacket = await postJson('/api/qa', {
    sceneId,
    question,
  });

  if (qaPacket.abstained) {
    return {
      liveAttempted: false,
      liveUsed: false,
      qaPacket,
      ttsState: {
        inputTranscript: question,
        outputTranscript: '',
        transcript: '',
        audioUrl: '',
        errorMessage: '',
        recoveryMessage: 'REST fallback abstained.',
      },
    };
  }

  try {
    const ttsPacket = await postJson('/api/tts', {
      text: qaPacket.answer,
      voice: 'mock-default',
    });

    return {
      liveAttempted: false,
      liveUsed: false,
      qaPacket,
      ttsState: toTtsState(ttsPacket, {
        inputTranscript: question,
        outputTranscript: ttsPacket.transcript,
        recoveryMessage: '',
      }),
    };
  } catch (error) {
    return {
      liveAttempted: false,
      liveUsed: false,
      qaPacket,
      ttsState: {
        inputTranscript: question,
        outputTranscript: qaPacket.answer,
        transcript: qaPacket.answer,
        audioUrl: '',
        errorMessage: error instanceof Error ? error.message : 'TTS unavailable',
        recoveryMessage: 'Grounded text preserved while audio fallback failed.',
      },
    };
  }
}

export async function readLiveCapability(readJson = (url) => fetch(url).then((response) => response.json())) {
  try {
    const payload = await readJson('/api/health');
    const qaLiveVoice = payload?.capabilities?.qaLiveVoice;

    return {
      enabled: Boolean(qaLiveVoice?.enabled),
      model: String(qaLiveVoice?.model ?? defaultLiveCapability().model),
    };
  } catch {
    return defaultLiveCapability();
  }
}

export async function submitQuestionTurn({
  sceneId,
  capability = defaultLiveCapability(),
  question = '',
  audio = null,
  postJson = defaultPostJson,
} = {}) {
  const liveAttempted = Boolean(capability?.enabled);
  const payload = audio
    ? {
        sceneId,
        audio,
      }
    : {
        sceneId,
        text: question,
      };

  if (!liveAttempted) {
    if (audio) {
      return {
        liveAttempted,
        liveUsed: false,
        qaPacket: null,
        ttsState: toAudioRecoveryState('Hỏi bằng giọng nói đang tạm không khả dụng. Hãy nhập câu hỏi bằng chữ.'),
      };
    }

    const restPacket = await restFallback({ sceneId, question, postJson });
    return {
      ...restPacket,
      liveAttempted,
    };
  }

  try {
    const livePacket = await postJson('/api/qa/live', payload);

    if (livePacket?.live === false) {
      return {
        liveAttempted: true,
        liveUsed: false,
        qaPacket: livePacket,
        ttsState: toTtsState(livePacket, {
          inputTranscript: livePacket.inputTranscript ?? question,
          outputTranscript: livePacket.outputTranscript ?? livePacket.answer,
          recoveryMessage: 'Live lỗi, đã fallback sang REST.',
        }),
      };
    }

    return {
      liveAttempted: true,
      liveUsed: true,
      qaPacket: livePacket,
      ttsState: toTtsState(livePacket, {
        inputTranscript: livePacket.inputTranscript ?? question,
        outputTranscript: livePacket.outputTranscript ?? livePacket.answer,
        recoveryMessage: '',
      }),
    };
  } catch (error) {
    if (audio) {
      const isTranscriptionFailure = error?.payload?.error?.code === 'LIVE_QA_TRANSCRIPTION_FAILED';
      return {
        liveAttempted: true,
        liveUsed: false,
        qaPacket: null,
        ttsState: toAudioRecoveryState(
          isTranscriptionFailure
            ? 'Audio chưa đủ để tạo transcript, hãy thử lại.'
            : 'Audio chưa có transcript, hãy nhập câu hỏi bằng chữ.',
          isTranscriptionFailure
            ? ''
            : error instanceof Error ? error.message : 'Live voice unavailable'
        ),
      };
    }

    const restPacket = await restFallback({ sceneId, question, postJson });
    return {
      ...restPacket,
      liveAttempted: true,
      liveUsed: false,
      ttsState: {
        ...restPacket.ttsState,
        recoveryMessage: 'Live lỗi, đã fallback sang REST.',
      },
    };
  }
}
