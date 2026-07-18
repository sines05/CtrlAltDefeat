import * as THREE from 'three';

export class UIController {
  constructor() {
    this.followBtn = document.getElementById('follow-btn');
    this.cancelNotice = document.getElementById('cancel-follow-notice');
    this.guideAskBubble = document.getElementById('guide-ask-bubble');
    this.dialogueBubble = document.getElementById('dialogue-bubble');
    this.speakerText = document.getElementById('dialogue-speaker');
    this.dialogueText = document.getElementById('dialogue-text');
    
    this.optType = document.getElementById('opt-type');
    this.optVoice = document.getElementById('opt-voice');
    this.optContinue = document.getElementById('opt-continue');
    this.optCancel = document.getElementById('opt-cancel');

    this.progress = document.getElementById('tour-progress');
    this.progressStepText = document.getElementById('progress-step-text');
    this.progressNameText = document.getElementById('progress-name-text');

    this.typingModal = document.getElementById('typing-modal');
    this.typingTextarea = document.getElementById('typing-textarea');
    this.typingCancel = document.getElementById('typing-cancel');
    this.typingSend = document.getElementById('typing-send');

    this.voiceModal = document.getElementById('voice-modal');
    this.micBtn = document.getElementById('mic-btn');
    this.micStatusText = document.getElementById('mic-status-text');
    this.voiceClose = document.getElementById('voice-close');

    this.toast = document.getElementById('toast-notification');

    this.plaquePrompt = document.getElementById('plaque-prompt');
    this.plaqueModal = document.getElementById('plaque-modal');
    this.plaqueClose = document.getElementById('plaque-close');

    this.villagePrompt = document.getElementById('village-prompt');
    this.villageModal = document.getElementById('village-modal');
    this.villageClose = document.getElementById('village-close');

    this.isRecording = false;
    this.toastTimeout = null;

    this.setupModals();
  }

  showFollowButton(visible, onClick) {
    if (visible) {
      this.followBtn.classList.add('visible');
      // Recreate event listener to avoid duplicate bindings
      this.followBtn.onclick = (e) => {
        e.stopPropagation();
        if (onClick) onClick();
      };
    } else {
      this.followBtn.classList.remove('visible');
    }
  }

  showDialogueBubble(speaker, text, options = {}) {
    this.speakerText.innerText = speaker;
    this.dialogueText.innerText = text;
    this.dialogueBubble.classList.add('visible');

    // Setup options callbacks
    this.optType.onclick = (e) => {
      e.stopPropagation();
      if (options.onType) options.onType();
    };

    this.optVoice.onclick = (e) => {
      e.stopPropagation();
      if (options.onVoice) options.onVoice();
    };

    this.optContinue.onclick = (e) => {
      e.stopPropagation();
      if (options.onContinue) options.onContinue();
    };

    this.optCancel.onclick = (e) => {
      e.stopPropagation();
      if (options.onCancel) options.onCancel();
    };
  }

  hideDialogueBubble() {
    this.dialogueBubble.classList.remove('visible');
  }

  showProgress(step, total, name) {
    this.progressStepText.innerText = `Bước ${step} / ${total}`;
    this.progressNameText.innerText = name;
    this.progress.classList.add('visible');
  }

  hideProgress() {
    this.progress.classList.remove('visible');
  }

  showToast(message) {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toast.innerText = message;
    this.toast.classList.add('visible');
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('visible');
    }, 3000);
  }

  setupModals() {
    // Typing Modal listeners
    this.typingCancel.onclick = () => {
      this.typingModal.classList.remove('visible');
    };

    this.typingSend.onclick = () => {
      const question = this.typingTextarea.value.trim();
      if (question.length === 0) {
        this.showToast("Vui lòng nhập câu hỏi!");
        return;
      }
      this.typingTextarea.value = "";
      this.typingModal.classList.remove('visible');
      this.showToast("AI backend coming soon.");
    };

    // Voice Modal listeners
    this.voiceClose.onclick = () => {
      this.stopRecordingSim();
      this.voiceModal.classList.remove('visible');
    };

    this.micBtn.onclick = () => {
      if (!this.isRecording) {
        this.startRecordingSim();
      } else {
        this.stopRecordingSim();
        setTimeout(() => {
          this.voiceModal.classList.remove('visible');
          this.showToast("Voice backend coming soon.");
        }, 1000);
      }
    };

    // Plaque Modal listeners
    if (this.plaqueClose) {
      this.plaqueClose.onclick = () => {
        this.plaqueModal.classList.remove('visible');
      };
    }

    // Village Modal listeners
    if (this.villageClose) {
      this.villageClose.onclick = () => {
        this.villageModal.classList.remove('visible');
      };
    }
  }

  openTypingModal() {
    this.typingTextarea.value = "";
    this.typingModal.classList.add('visible');
    this.typingTextarea.focus();
  }

  openVoiceModal() {
    this.isRecording = false;
    this.micBtn.classList.remove('recording');
    this.micStatusText.innerText = "Nhấn nút để bắt đầu ghi âm";
    this.voiceModal.classList.add('visible');
  }

  startRecordingSim() {
    this.isRecording = true;
    this.micBtn.classList.add('recording');
    this.micStatusText.innerText = "Đang lắng nghe... Nhấn lại để hoàn tất.";
  }

  stopRecordingSim() {
    this.isRecording = false;
    this.micBtn.classList.remove('recording');
    this.micStatusText.innerText = "Đang xử lý giọng nói...";
  }

  showCancelNotice(visible) {
    if (this.cancelNotice) {
      if (visible) {
        this.cancelNotice.classList.add('visible');
      } else {
        this.cancelNotice.classList.remove('visible');
      }
    }
  }

  showGuideAskBubble(visible) {
    if (this.guideAskBubble) {
      if (visible) {
        this.guideAskBubble.classList.add('visible');
      } else {
        this.guideAskBubble.classList.remove('visible');
      }
    }
  }

  updateGuideAskBubble(camera, guide) {
    if (!this.guideAskBubble || !this.guideAskBubble.classList.contains('visible') || !guide) return;

    const pos = new THREE.Vector3().copy(guide.position);
    pos.y += 3.2; // Spacing above the guide's head (accounting for guide scale)

    pos.project(camera);

    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

    if (pos.z > 1) {
      this.guideAskBubble.style.opacity = '0';
      this.guideAskBubble.style.visibility = 'hidden';
    } else {
      this.guideAskBubble.style.opacity = '1';
      this.guideAskBubble.style.visibility = 'visible';
      this.guideAskBubble.style.left = `${x}px`;
      this.guideAskBubble.style.top = `${y}px`;
    }
  }
}
export const uiController = new UIController();
