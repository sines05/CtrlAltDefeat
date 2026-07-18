import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { GuideFSM, GUIDE_STATES } from '../../apps/web/src/systems/GuideFSM.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function createAction() {
  return {
    play() {},
    reset() { return this; },
    fadeIn() { return this; },
    fadeOut() { return this; },
  };
}

function createAudio() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    async play() {},
    pause() {},
    emit(type) {
      listeners.get(type)?.();
    },
  };
}

test('test_guide_uses_talking_gesture_while_answer_audio_plays', async () => {
  const guide = new GuideFSM(null, null, {
    idle: createAction(),
    walk: createAction(),
    talk: createAction(),
  });
  const audio = createAudio();

  await guide.playAnswerAudio(audio);
  assert.equal(guide.currentState, GUIDE_STATES.TALKING);

  audio.emit('ended');
  assert.equal(guide.currentState, GUIDE_STATES.IDLE);
});

test('test_voice_ui_submits_real_turns_and_routes_audio_to_the_guide', async () => {
  const [mainSource, uiSource] = await Promise.all([
    readFile(path.join(repoRoot, 'apps/web/src/main.js'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/systems/UIController.js'), 'utf8'),
  ]);

  assert.match(mainSource, /submitQuestionTurn\(/u);
  assert.match(mainSource, /playAnswerAudio\(/u);
  assert.match(mainSource, /resetVoiceState\(\) \{\n\s+tourManager\?\.resetQuestionState\?\.\(\);/u);
  assert.match(uiSource, /navigator\.mediaDevices\?\.getUserMedia/u);
  assert.match(uiSource, /MediaRecorder\.isTypeSupported/u);
  assert.match(uiSource, /MAX_RECORDING_MS/u);
  assert.doesNotMatch(uiSource, /backend coming soon/iu);
});
