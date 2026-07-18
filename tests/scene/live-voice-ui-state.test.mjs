import assert from 'node:assert/strict';
import test from 'node:test';

const UI_IDS = [
  'follow-btn',
  'cancel-follow-notice',
  'guide-ask-bubble',
  'dialogue-bubble',
  'dialogue-speaker',
  'dialogue-text',
  'opt-type',
  'opt-voice',
  'opt-continue',
  'tour-progress',
  'progress-step-text',
  'progress-name-text',
  'typing-modal',
  'typing-textarea',
  'typing-cancel',
  'typing-send',
  'voice-modal',
  'mic-btn',
  'mic-status-text',
  'voice-close',
  'toast-notification',
];

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function createElement() {
  return {
    classList: createClassList(),
    style: {},
    innerText: '',
    value: '',
    onclick: null,
    focus() {},
  };
}

function installDocument() {
  const elements = new Map(UI_IDS.map((id) => [id, createElement()]));
  globalThis.document = {
    getElementById(id) {
      return elements.get(id) ?? null;
    },
  };
  return elements;
}

function createStream(trackStops) {
  return {
    getTracks() {
      return [{
        stop() {
          trackStops.push('stop');
        },
      }];
    },
  };
}

async function importUiController(tag) {
  return import(new URL(`../../apps/web/src/systems/UIController.js?${tag}`, import.meta.url));
}

test('test_voice_ui_submits_audio_once_and_resets_state_after_submit', async (t) => {
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousMediaRecorder = globalThis.MediaRecorder;
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const createdMimeTypes = [];
  const trackStops = [];
  const scheduledDelays = [];
  const elements = installDocument();
  const submissions = [];
  const resets = [];

  t.after(() => {
    globalThis.document = previousDocument;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
    globalThis.MediaRecorder = previousMediaRecorder;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
  });

  globalThis.setTimeout = (callback, delay = 0) => {
    scheduledDelays.push(delay);
    return previousSetTimeout(callback, 0);
  };
  globalThis.clearTimeout = previousClearTimeout;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return createStream(trackStops);
        },
      },
    },
  });
  globalThis.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === 'audio/webm;codecs=opus';
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.state = 'inactive';
      this.mimeType = options.mimeType ?? '';
      createdMimeTypes.push(this.mimeType);
      this.ondataavailable = null;
      this.onstop = null;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      if (this.state !== 'recording') {
        return;
      }
      this.state = 'inactive';
      this.onstop?.();
    }

    emitChunk(data) {
      this.ondataavailable?.({ data });
    }
  };

  const { UIController } = await importUiController(`submit-${Date.now()}`);
  const controller = new UIController();
  controller.setQuestionHandlers({
    async submitAudio(payload) {
      submissions.push(payload);
    },
    resetVoiceState() {
      resets.push('reset');
    },
  });

  controller.openVoiceModal();
  await controller.startRecording();
  const recorder = controller.mediaRecorder;
  recorder.emitChunk(new Blob(['voice'], { type: 'audio/webm;codecs=opus' }));
  controller.stopRecording();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(createdMimeTypes, ['audio/webm;codecs=opus']);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].mimeType, 'audio/webm;codecs=opus');
  assert.equal(resets.length, 1);
  assert.equal(controller.voiceModal.classList.contains('visible'), false);
  assert.equal(controller.isRecording, false);
  assert.equal(controller.micStatusText.innerText, 'Nhấn nút để bắt đầu ghi âm');
  assert.ok(trackStops.length > 0);
  assert.ok(scheduledDelays.some((delay) => delay >= 29000));
  assert.equal(elements.get('toast-notification').innerText, '');
});

test('test_voice_ui_recovers_from_empty_recording_without_submit', async (t) => {
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousMediaRecorder = globalThis.MediaRecorder;
  const elements = installDocument();
  const submissions = [];
  const resets = [];

  t.after(() => {
    globalThis.document = previousDocument;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
    globalThis.MediaRecorder = previousMediaRecorder;
  });

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return createStream([]);
        },
      },
    },
  });
  globalThis.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === 'audio/webm;codecs=opus';
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.state = 'inactive';
      this.mimeType = options.mimeType ?? '';
      this.ondataavailable = null;
      this.onstop = null;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      if (this.state !== 'recording') {
        return;
      }
      this.state = 'inactive';
      this.onstop?.();
    }
  };

  const { UIController } = await importUiController(`empty-${Date.now()}`);
  const controller = new UIController();
  controller.setQuestionHandlers({
    async submitAudio(payload) {
      submissions.push(payload);
    },
    resetVoiceState() {
      resets.push('reset');
    },
  });

  controller.openVoiceModal();
  await controller.startRecording();
  controller.stopRecording();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(submissions.length, 0);
  assert.equal(resets.length, 1);
  assert.equal(controller.voiceModal.classList.contains('visible'), false);
  assert.equal(controller.isRecording, false);
  assert.equal(controller.micStatusText.innerText, 'Nhấn nút để bắt đầu ghi âm');
  assert.match(elements.get('toast-notification').innerText, /Không ghi nhận được âm thanh/u);
});

test('test_voice_ui_stops_stream_when_media_recorder_setup_fails', async (t) => {
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  const previousMediaRecorder = globalThis.MediaRecorder;
  const elements = installDocument();
  const resets = [];
  const trackStops = [];

  t.after(() => {
    globalThis.document = previousDocument;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator,
    });
    globalThis.MediaRecorder = previousMediaRecorder;
  });

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        async getUserMedia() {
          return createStream(trackStops);
        },
      },
    },
  });
  globalThis.MediaRecorder = class FakeMediaRecorder {
    static isTypeSupported(mimeType) {
      return mimeType === 'audio/webm;codecs=opus';
    }

    constructor() {
      throw new Error('recorder unavailable');
    }
  };

  const { UIController } = await importUiController(`constructor-fail-${Date.now()}`);
  const controller = new UIController();
  controller.setQuestionHandlers({
    async submitAudio() {
      throw new Error('submitAudio should not be called when recorder setup fails');
    },
    resetVoiceState() {
      resets.push('reset');
    },
  });

  controller.openVoiceModal();
  await controller.startRecording();

  assert.ok(trackStops.length > 0);
  assert.equal(resets.length, 1);
  assert.equal(controller.voiceModal.classList.contains('visible'), false);
  assert.match(elements.get('toast-notification').innerText, /Không thể dùng micro/u);
});
