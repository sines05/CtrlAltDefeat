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

    this.questionHandlers = null;
    this.mediaRecorder = null;
    this.recordingStream = null;
    this.recordingStartedAt = 0;
    this.discardRecording = false;
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
      void this.questionHandlers?.submitText?.(question);
    };

    // Voice Modal listeners
    this.voiceClose.onclick = () => {
      this.cancelRecording();
      this.voiceModal.classList.remove('visible');
    };

    this.micBtn.onclick = () => {
      if (!this.isRecording) {
        void this.startRecording();
        return;
      }

      this.stopRecording();
    };
  }

  setQuestionHandlers(handlers) {
    this.questionHandlers = handlers;
  }

  async startRecording() {
    // Voice input is optional convenience, not a gate. If permissions, browser support, or
    // live services fail, the same cultural walkthrough must remain reachable through typing.
    if (!this.questionHandlers?.submitAudio) {
      this.showToast('Voice assistant is unavailable.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.showToast('Trình duyệt không hỗ trợ ghi âm.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      this.recordingStream = stream;
      this.mediaRecorder = recorder;
      this.recordingStartedAt = Date.now();
      this.discardRecording = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onstop = () => {
        const discard = this.discardRecording;
        const durationMs = Date.now() - this.recordingStartedAt;
        const blob = new Blob(chunks, { type: recorder.mimeType });

        stream.getTracks().forEach((track) => track.stop());
        this.mediaRecorder = null;
        this.recordingStream = null;
        this.isRecording = false;
        this.micBtn.classList.remove('recording');

        if (!discard && blob.size > 0) {
          this.voiceModal.classList.remove('visible');
          void this.questionHandlers.submitAudio({ blob, mimeType: blob.type, durationMs });
        }
      };
      recorder.start();
      this.startRecordingSim();
    } catch {
      this.showToast('Không thể dùng micro. Hãy kiểm tra quyền truy cập.');
    }
  }

  stopRecording() {
    if (this.mediaRecorder?.state === 'recording') {
      this.stopRecordingSim();
      this.mediaRecorder.stop();
    }
  }

  cancelRecording() {
    this.discardRecording = true;
    this.stopRecording();
    this.recordingStream?.getTracks().forEach((track) => track.stop());
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
