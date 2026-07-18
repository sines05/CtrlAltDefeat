import { loadAvatarViewModel, ensureAvatarRuntime } from './avatar/runtime.js';
import { readLiveCapability, submitQuestionTurn } from './qa/live-client.js';
import { createSceneAppHtml } from './scene/app.js';

const currentUrl = new URL(window.location.href);
const sceneId = 'tay-ho-giay-do-room-01';
const selectedAvatarId = currentUrl.searchParams.get('avatar') === 'huongdanvien'
  ? 'huongdanvien'
  : 'cesium-man';
const fallbackRequested = currentUrl.searchParams.get('fallback') === '1';
const hasWebGL = !fallbackRequested && Boolean(document.createElement('canvas').getContext('webgl2'));

async function readJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to post ${url}: ${response.status}`);
  }

  return response.json();
}

async function loadAvatarContext() {
  try {
    const [avatar, hasAvatarRuntime] = await Promise.all([
      loadAvatarViewModel(selectedAvatarId),
      ensureAvatarRuntime(),
    ]);

    return { avatar, hasAvatarRuntime };
  } catch {
    return {
      avatar: {
        status: 'error',
        title: selectedAvatarId === 'huongdanvien' ? 'Hướng dẫn viên' : 'CesiumMan',
        fallbackLabel: selectedAvatarId === 'huongdanvien' ? 'Static preview unavailable' : 'Avatar unavailable',
      },
      hasAvatarRuntime: false,
    };
  }
}

function createInitialInteractionState() {
  return {
    question: '',
    qaPacket: null,
    isLoading: false,
    isRecording: false,
    liveCapability: {
      enabled: false,
      model: 'gemini-3.1-flash-live-preview',
    },
    statusMessage: 'Sẵn sàng nhận câu hỏi.',
    eventLog: ['App ready.'],
    ttsState: {
      transcript: '',
      inputTranscript: '',
      outputTranscript: '',
      recoveryMessage: '',
      audioUrl: '',
      errorMessage: '',
    },
  };
}

function appendLog(currentLog, message) {
  return [...currentLog.slice(-5), message];
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

async function bootstrap() {
  const [scene, tour, avatarContext, liveCapability] = await Promise.all([
    readJson(`/api/scene/${sceneId}`),
    readJson('/api/tour/tour-01'),
    loadAvatarContext(),
    readLiveCapability(async (url) => readJson(url)),
  ]);
  const app = document.querySelector('#app');
  const state = {
    interaction: {
      ...createInitialInteractionState(),
      liveCapability,
    },
  };
  let activeRecorder = null;
  let activeRecorderStream = null;
  let recorderChunks = [];
  let recorderStartedAt = 0;

  async function commitTurnResult({ question, result, successMessage, fallbackMessage }) {
    state.interaction = {
      ...state.interaction,
      question,
      qaPacket: result.qaPacket,
      isLoading: false,
      isRecording: false,
      statusMessage: result.qaPacket?.abstained
        ? 'Không đủ bằng chứng để trả lời câu hỏi này.'
        : successMessage,
      eventLog: appendLog(
        state.interaction.eventLog,
        result.liveUsed
          ? `Live answer received with ${result.qaPacket.citations.length} citation(s).`
          : fallbackMessage,
      ),
      ttsState: result.ttsState,
    };
    render();

    if (result.ttsState.audioUrl) {
      const audio = new Audio(result.ttsState.audioUrl);
      void audio.play().catch(() => {});
    }
  }

  async function submitQuestion(question) {
    state.interaction = {
      ...state.interaction,
      question,
      isLoading: true,
      statusMessage: 'Đang gửi câu hỏi tới Live grounded chat…',
      eventLog: appendLog(state.interaction.eventLog, `Question submitted: ${question}`),
      ttsState: {
        transcript: '',
        inputTranscript: '',
        outputTranscript: '',
        recoveryMessage: '',
        audioUrl: '',
        errorMessage: '',
      },
    };
    render();

    try {
      const result = await submitQuestionTurn({
        sceneId,
        capability: state.interaction.liveCapability,
        question,
        postJson,
      });

      await commitTurnResult({
        question,
        result,
        successMessage: result.liveUsed
          ? 'Đã nhận phản hồi Live grounded.'
          : 'Đã fallback sang grounded REST.',
        fallbackMessage: result.liveUsed
          ? `Live answer received with ${result.qaPacket.citations.length} citation(s).`
          : 'Live lỗi, đã fallback sang REST.',
      });
    } catch (error) {
      state.interaction = {
        ...state.interaction,
        qaPacket: null,
        isLoading: false,
        isRecording: false,
        statusMessage: error instanceof Error ? error.message : 'Không lấy được phản hồi từ grounded chat.',
        eventLog: appendLog(
          state.interaction.eventLog,
          error instanceof Error ? `Question failed: ${error.message}` : 'Question failed: unknown error.',
        ),
        ttsState: {
          transcript: '',
          inputTranscript: '',
          outputTranscript: '',
          recoveryMessage: '',
          audioUrl: '',
          errorMessage: '',
        },
      };
      render();
    }
  }

  function stopRecorderStream() {
    activeRecorderStream?.getTracks().forEach((track) => track.stop());
    activeRecorderStream = null;
  }

  async function submitRecordedAudio(blob, durationMs) {
    state.interaction = {
      ...state.interaction,
      isLoading: true,
      isRecording: false,
      statusMessage: 'Đang gửi audio tới Live grounded chat…',
      eventLog: appendLog(state.interaction.eventLog, 'Voice turn submitted.'),
    };
    render();

    try {
      const result = await submitQuestionTurn({
        sceneId,
        capability: state.interaction.liveCapability,
        audio: {
          mimeType: blob.type || 'audio/webm',
          dataBase64: await blobToBase64(blob),
          durationMs,
        },
        postJson,
      });
      const derivedQuestion = result.ttsState.inputTranscript || state.interaction.question;

      state.interaction = {
        ...state.interaction,
        question: derivedQuestion,
        qaPacket: result.qaPacket,
        isLoading: false,
        isRecording: false,
        statusMessage: result.qaPacket
          ? result.liveUsed
            ? 'Đã nhận phản hồi Live voice.'
            : 'Voice fallback sang grounded REST.'
          : 'Audio chưa tạo được transcript, hãy nhập câu hỏi bằng chữ.',
        eventLog: appendLog(
          state.interaction.eventLog,
          result.liveUsed
            ? 'Live voice answer received.'
            : result.qaPacket
              ? 'Voice turn fell back to REST.'
              : 'Voice turn ended without transcript.',
        ),
        ttsState: result.ttsState,
      };
      render();

      if (result.ttsState.audioUrl) {
        const audio = new Audio(result.ttsState.audioUrl);
        void audio.play().catch(() => {});
      }
    } catch (error) {
      state.interaction = {
        ...state.interaction,
        isLoading: false,
        isRecording: false,
        statusMessage: error instanceof Error ? error.message : 'Live voice unavailable',
        eventLog: appendLog(
          state.interaction.eventLog,
          error instanceof Error ? `Voice turn failed: ${error.message}` : 'Voice turn failed: unknown error.',
        ),
        ttsState: {
          transcript: '',
          inputTranscript: '',
          outputTranscript: '',
          recoveryMessage: 'Audio chưa có transcript, hãy nhập câu hỏi bằng chữ.',
          audioUrl: '',
          errorMessage: error instanceof Error ? error.message : 'Live voice unavailable',
        },
      };
      render();
    }
  }

  if (!app) {
    return;
  }

  const render = () => {
    app.innerHTML = createSceneAppHtml({
      scene,
      tour,
      hasWebGL,
      avatar: avatarContext.avatar,
      hasAvatarRuntime: avatarContext.hasAvatarRuntime,
      interactionState: state.interaction,
    });

    const qaForm = app.querySelector('[data-role="qa-form"]');
    const ttsButton = app.querySelector('[data-action="play-tts"]');
    const recordButton = app.querySelector('[data-action="record-voice"]');

    if (qaForm instanceof HTMLFormElement) {
      qaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(qaForm);
        const question = String(formData.get('question') ?? '').trim();

        if (!question) {
          state.interaction = {
            ...state.interaction,
            question: '',
            isLoading: false,
            statusMessage: 'Nhập câu hỏi trước khi gửi.',
            eventLog: appendLog(state.interaction.eventLog, 'Question rejected: empty input.'),
          };
          render();
          return;
        }

        await submitQuestion(question);
      });
    }

    if (recordButton instanceof HTMLButtonElement) {
      recordButton.addEventListener('click', async () => {
        if (state.interaction.isRecording) {
          activeRecorder?.stop();
          return;
        }

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          state.interaction = {
            ...state.interaction,
            statusMessage: 'Thiết bị này không hỗ trợ ghi âm.',
            eventLog: appendLog(state.interaction.eventLog, 'Voice recording unavailable.'),
            ttsState: {
              transcript: '',
              inputTranscript: '',
              outputTranscript: '',
              recoveryMessage: 'Nhập câu hỏi bằng chữ để tiếp tục.',
              audioUrl: '',
              errorMessage: '',
            },
          };
          render();
          return;
        }

        state.interaction = {
          ...state.interaction,
          isRecording: true,
          statusMessage: 'Đang ghi âm câu hỏi…',
          eventLog: appendLog(state.interaction.eventLog, 'Voice recording started.'),
        };
        render();

        try {
          activeRecorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          recorderChunks = [];
          recorderStartedAt = Date.now();
          const recorderOptions = MediaRecorder.isTypeSupported('audio/webm')
            ? { mimeType: 'audio/webm' }
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? { mimeType: 'audio/mp4' }
              : undefined;
          activeRecorder = new MediaRecorder(activeRecorderStream, recorderOptions);
          activeRecorder.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0) {
              recorderChunks.push(event.data);
            }
          });
          activeRecorder.addEventListener('stop', async () => {
            const blob = new Blob(recorderChunks, { type: activeRecorder?.mimeType || 'audio/webm' });
            const durationMs = Math.max(1, Date.now() - recorderStartedAt);
            activeRecorder = null;
            stopRecorderStream();

            if (!blob.size) {
              state.interaction = {
                ...state.interaction,
                isLoading: false,
                isRecording: false,
                statusMessage: 'Không thu được audio hợp lệ.',
                eventLog: appendLog(state.interaction.eventLog, 'Voice recording ended empty.'),
                ttsState: {
                  transcript: '',
                  inputTranscript: '',
                  outputTranscript: '',
                  recoveryMessage: 'Audio chưa có transcript, hãy nhập câu hỏi bằng chữ.',
                  audioUrl: '',
                  errorMessage: '',
                },
              };
              render();
              return;
            }

            await submitRecordedAudio(blob, durationMs);
          });
          activeRecorder.start();
        } catch (error) {
          stopRecorderStream();
          activeRecorder = null;
          state.interaction = {
            ...state.interaction,
            isRecording: false,
            statusMessage: error instanceof Error ? error.message : 'Không bắt đầu được ghi âm.',
            eventLog: appendLog(
              state.interaction.eventLog,
              error instanceof Error ? `Voice recording failed: ${error.message}` : 'Voice recording failed: unknown error.',
            ),
            ttsState: {
              transcript: '',
              inputTranscript: '',
              outputTranscript: '',
              recoveryMessage: 'Nhập câu hỏi bằng chữ để tiếp tục.',
              audioUrl: '',
              errorMessage: error instanceof Error ? error.message : 'Không bắt đầu được ghi âm.',
            },
          };
          render();
        }
      });
    }

    if (ttsButton instanceof HTMLButtonElement) {
      ttsButton.addEventListener('click', async () => {
        if (!state.interaction.qaPacket || state.interaction.qaPacket.abstained) {
          return;
        }

        if (state.interaction.ttsState.audioUrl) {
          const audio = new Audio(state.interaction.ttsState.audioUrl);
          void audio.play().catch(() => {});
          return;
        }

        state.interaction = {
          ...state.interaction,
          statusMessage: 'Đang tạo audio từ câu trả lời hiện tại…',
          eventLog: appendLog(state.interaction.eventLog, 'TTS requested for latest grounded answer.'),
        };
        render();

        try {
          const ttsPacket = await postJson('/api/tts', {
            text: state.interaction.qaPacket.answer,
            voice: 'mock-default',
          });

          state.interaction = {
            ...state.interaction,
            statusMessage: 'Audio đã sẵn sàng.',
            eventLog: appendLog(state.interaction.eventLog, 'TTS response received.'),
            ttsState: {
              transcript: ttsPacket.transcript,
              audioUrl: ttsPacket.audioUrl,
              errorMessage: '',
            },
          };
          render();

          if (ttsPacket.audioUrl) {
            const audio = new Audio(ttsPacket.audioUrl);
            void audio.play().catch(() => {});
          }
        } catch (error) {
          state.interaction = {
            ...state.interaction,
            statusMessage: error instanceof Error ? error.message : 'TTS unavailable',
            eventLog: appendLog(
              state.interaction.eventLog,
              error instanceof Error ? `TTS failed: ${error.message}` : 'TTS failed: unknown error.',
            ),
            ttsState: {
              transcript: state.interaction.qaPacket.answer,
              audioUrl: '',
              errorMessage: error instanceof Error ? error.message : 'TTS unavailable',
            },
          };
          render();
        }
      });
    }
  };

  render();
}

void bootstrap().catch((error) => {
  const app = document.querySelector('#app');

  if (app) {
    app.innerHTML = `<p data-mode="fallback">Chế độ suy giảm: ${error instanceof Error ? error.message : 'Không tải được cảnh.'}</p>`;
  }
});
