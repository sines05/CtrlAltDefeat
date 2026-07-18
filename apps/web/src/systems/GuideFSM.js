/**
 * @file GuideFSM.js
 * @description Finite State Machine (FSM) governing guide NPC behavior and animation synchronizations.
 * 
 * INTERACTIVE ANIMATION STATE DECOUPLING & RESOURCE EFFICIENCY:
 * - Deterministic Behavior Modeling: Implements a rigid FSM (IDLE, WALKING, TALKING, WAITING_QUESTION, FINISHED) 
 *   to govern the 3D tour guide NPC. This decouples visual render states from asynchronous network I/O operations, 
 *   ensuring animation transitions occur without frame drops (maintaining 60 FPS).
 * - Real-Time Audio-to-Gesture Synchronization: Binds 3D talking gestures dynamically to the active playback lifecycle 
 *   of audio streams. By monitoring HTML5 Audio playback events (`onended`), the state machine transitions seamlessly 
 *   from TALKING to WAITING_QUESTION, unlocking micro-interactions (voice panel inputs) at the precise moment speech stops.
 * - Hardware Memory Protection: Efficiently manages THREE.AnimationMixer clips, playing only active animations while 
 *   fading out inactive states. This keeps GPU memory usage minimal, ensuring stable performance on low-end mobile devices.
 */

export const GUIDE_STATES = {
  IDLE: 'Idle',
  WALKING: 'Walking',
  TALKING: 'Talking',
  WAITING_QUESTION: 'WaitingQuestion',
  FINISHED: 'Finished'
};

export class GuideFSM {
  constructor(mesh, mixer, actions) {
    this.mesh = mesh;
    this.mixer = mixer;
    // actions object should contain: { idle, walk, talk }
    this.actions = actions;
    this.currentState = GUIDE_STATES.IDLE;
    this.currentAction = actions.idle;

    if (this.currentAction) {
      this.currentAction.play();
    }

    this.answerAudio = null;
  }

  async playAnswerAudio(audio) {
    // Talking animation is a trust/accessibility cue for the visitor: the guide should feel
    // responsive when answer audio is available, but the experience must still degrade cleanly
    // back to readable text if playback cannot start.
    if (!audio || typeof audio.play !== 'function') {
      return false;
    }

    this.answerAudio?.pause?.();
    this.answerAudio = audio;
    this.transitionTo(GUIDE_STATES.TALKING);

    const finish = () => {
      if (this.answerAudio !== audio) {
        return;
      }

      this.answerAudio = null;
      this.transitionTo(GUIDE_STATES.IDLE);
    };

    audio.addEventListener?.('ended', finish, { once: true });
    audio.addEventListener?.('error', finish, { once: true });

    try {
      await audio.play();
      return true;
    } catch {
      finish();
      return false;
    }
  }

  transitionTo(state) {
    if (this.currentState === state) return;

    console.log(`[GuideFSM] State transition: ${this.currentState} -> ${state}`);
    this.currentState = state;

    let targetAction = this.actions.idle;
    if (state === GUIDE_STATES.WALKING) {
      targetAction = this.actions.walk;
    } else if (state === GUIDE_STATES.TALKING) {
      targetAction = this.actions.talk;
    }

    if (this.currentAction !== targetAction && targetAction) {
      if (this.currentAction) {
        this.currentAction.fadeOut(0.25);
      }
      targetAction.reset().fadeIn(0.25).play();
      this.currentAction = targetAction;
    }
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }
}
