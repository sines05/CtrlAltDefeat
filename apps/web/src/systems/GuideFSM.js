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
