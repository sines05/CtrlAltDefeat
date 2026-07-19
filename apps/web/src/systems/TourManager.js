/**
 * @file TourManager.js
 * @description State machine and narrative runner governing exhibition flow.
 * 
 * MULTISENSORY INTERACTION STATE MACHINE & INCLUSIVE RESILIENCY FALLBACKS:
 * - Immersive multisensory exhibition: Integrates user navigation dynamics with the guide's 3D avatar FSM 
 *   (IDLE, WALKING, TALKING, WAITING_QUESTION). This maps user coordinates directly to visual cues and audio 
 *   narration, transforming the papermaking steps into an engaging, responsive educational loop.
 * - Fault Tolerance & Hybrid Narration: Designed for low-connectivity environments (such as remote villages or 
 *   concrete gallery basement cellars). It uses a hybrid speech rendering fallback mechanism:
 *   1. Primary: Fetches synthesized Vietnamese speech files (.wav) from the local backend TTS API.
 *   2. Secondary Fallback: Automatically falls back to the client browser's native Web Speech API (speechSynthesis).
 *   3. Tertiary Fallback: Degrades to character-length-based silent timers.
 * - Accessibility & Synchronization: Keeps visual guide gestures (lip-sync/talking animation state) strictly synced 
 *   with active audio playback runtime, providing crucial visual cues for the hearing impaired.
 */

import * as THREE from 'three';
import { GUIDE_STATES } from './GuideFSM.js';
import { uiController } from './UIController.js';

export const PLAYER_STATES = {
  FREE: 'Free',
  FOLLOWING_GUIDE: 'FollowingGuide',
  WATCHING_DIALOGUE: 'WatchingDialogue',
  QUESTION_INPUT: 'QuestionInput',
  QUESTION_VOICE: 'QuestionVoice'
};

export class TourManager {
  constructor(scene, camera, controls, playerMesh, playerMixer, playerActions, guideNPC, guideFSM, stations) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    
    this.player = playerMesh;
    this.playerMixer = playerMixer;
    this.playerActions = playerActions; // { idle, walk, talk }
    this.playerCurrentAction = playerActions.idle;

    this.guide = guideNPC;
    this.guideFSM = guideFSM;
    
    this.stations = stations;
    this.currentStationIdx = 0;
    this.playerState = PLAYER_STATES.FREE;
    
    this.guideSpeed = 2.0;
    this.playerFollowDistance = 1.6; // 1.6 meters behind guide
    
    this.narrationTimer = 0;
    this.isSpeaking = false;
    this.hasWelcomed = false;
    this.isWelcoming = false;
    this.hasArrivedAtFirstStation = false;
    
    // Save original camera target/distance settings to restore after tour
    this.originalTarget = new THREE.Vector3().copy(controls.target);
    this.speechTimeout = null;
    
    this.setupUIEvents();
  }

  resetQuestionState() {
    if (
      this.playerState === PLAYER_STATES.QUESTION_INPUT
      || this.playerState === PLAYER_STATES.QUESTION_VOICE
    ) {
      this.playerState = this.previousPlayerState || PLAYER_STATES.FREE;
      this.previousPlayerState = null;
    }
  }

  setupUIEvents() {
    // When the user clicks the "Continue" option on the dialogue bubble
    uiController.optContinue.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isSpeaking) {
        this.skipCurrentNarration();
      } else if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.nextStation();
      }
    });

    uiController.optType.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.previousPlayerState = PLAYER_STATES.WATCHING_DIALOGUE;
        this.playerState = PLAYER_STATES.QUESTION_INPUT;
        uiController.openTypingModal();
      }
    });

    uiController.optVoice.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.previousPlayerState = PLAYER_STATES.WATCHING_DIALOGUE;
        this.playerState = PLAYER_STATES.QUESTION_VOICE;
        uiController.openVoiceModal();
      }
    });

    // Handle close/cancel actions to return to WATCHING_DIALOGUE state
    uiController.typingCancel.addEventListener('click', () => {
      this.resetQuestionState();
    });
    uiController.typingSend.addEventListener('click', () => {
      this.resetQuestionState();
    });
    uiController.voiceClose.addEventListener('click', () => {
      this.resetQuestionState();
    });
  }

  fadePlayerAction(action) {
    if (this.playerCurrentAction === action) return;
    if (this.playerCurrentAction) {
      this.playerCurrentAction.fadeOut(0.2);
    }
    action.reset().fadeIn(0.2).play();
    this.playerCurrentAction = action;
  }

  get language() {
    return window.currentLanguage || 'vi';
  }

  startTour() {
    this.playerState = PLAYER_STATES.FOLLOWING_GUIDE;
    uiController.showFollowButton(false);
    
    // Show cancel notice and hide head bubble
    uiController.showCancelNotice(true);
    uiController.showGuideAskBubble(false);

    // Save original controls target
    this.originalTarget.copy(this.controls.target);

    this.isWelcoming = true;
    this.hasArrivedAtFirstStation = false;

    const welcomeTextVi = "Kính chào quý vị và các bạn đến với mô phỏng phòng trưng bày phương pháp làm giấy nằm ở 189 Trích Sài, Hồ Tây, Hà Nội.\n\nTrước khi bắt đầu, bạn có biết rằng Việt Nam có một loại giấy truyền thống được gọi là giấy Dó. Loại giấy này được dân ta sử dụng để vẽ tranh Đông Hồ, làm chiếu chỉ hoàng gia, hay là lưu trữ kinh Phật. Phương pháp làm giấy dó này đã được lưu truyền từ thê kỷ thứ 13, tuy nhiên, do những thay đổi trong chính sách kinh tế trong giai đoạn Đổi Mới những năm 1980, những gia đình làm giấy thủ công truyền thống đổi sang những công việc khác khiến cho phương pháp làm giấy Dó truyền thống gần như bị mất. Hiện tại, chỉ còn trên dưới 10 hộ gia đình còn tiếp tục làm giấy Dó khắp Việt Nam.\n\nKhu vực Tây Hồ này hồi trước có một làng nghề làm giấy nổi tiếng là làng Yên Thái. Chúng mình đã mô phỏng lại phòng trưng bày các bước làm giấy Dó ở Trích Sài.";
    const welcomeTextEn = "Welcome, ladies and gentlemen, to the simulation of the paper-making gallery located at 189 Trich Sai, Tay Ho, Hanoi. Before we begin, did you know that Vietnam has a traditional paper called Dó paper? This paper was used by our people to paint Dong Ho paintings, write royal decrees, or store Buddhist scriptures. The method of making this Dó paper has been passed down since the 13th century. However, due to economic changes during the Doi Moi period in the 1980s, traditional hand-made paper families switched to other jobs, causing the traditional Dó paper method to almost fade away. Here, I will introduce to you the 10 steps in this traditional Dó paper making process.";
    const welcomeText = this.language === 'en' ? welcomeTextEn : welcomeTextVi;
    const speaker = this.language === 'en' ? "Tour Guide" : "Hướng dẫn viên";

    uiController.showDialogueBubble(speaker, welcomeText, {
      onCancel: () => this.cancelFollow()
    });
    
    uiController.optContinue.textContent = this.language === 'en' ? "Skip Intro" : "Bỏ qua giới thiệu";
    uiController.optContinue.style.display = '';
    uiController.optType.style.display = 'none';
    uiController.optVoice.style.display = 'none';
    if (uiController.optCancel) {
      uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
      uiController.optCancel.style.display = '';
    }

    this.speakNarration(welcomeText, () => {
      this.isWelcoming = false;
      if (this.hasArrivedAtFirstStation) {
        this.triggerStationArrival();
      }
    }, this.language === 'en' ? '/audio/narration/welcome_en.wav' : '/audio/narration/welcome.wav');

    // Walk to the first station immediately
    const currentStation = this.stations[this.currentStationIdx];
    const stationName = this.language === 'en' ? (currentStation.nameEn || currentStation.name) : currentStation.name;
    uiController.showProgress(currentStation.stepNum, this.stations.length, stationName);

    this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
    this.fadePlayerAction(this.playerActions.walk);
  }

  triggerStationArrival() {
    this.hasArrivedAtFirstStation = false;
    const currentStation = this.stations[this.currentStationIdx];
    if (!currentStation) return;

    this.guideFSM.transitionTo(GUIDE_STATES.TALKING);
    const speaker = this.language === 'en' ? "Tour Guide" : "Hướng dẫn viên";
    const narrationText = this.language === 'en' ? (currentStation.narrationEn || currentStation.narration) : currentStation.narration;
    uiController.showDialogueBubble(speaker, narrationText, {
      onCancel: () => this.cancelFollow()
    });

    uiController.optContinue.textContent = this.language === 'en' ? "Skip Narration" : "Bỏ qua thuyết minh";
    uiController.optContinue.style.display = '';
    uiController.optType.style.display = 'none';
    uiController.optVoice.style.display = 'none';
    if (uiController.optCancel) {
      uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
      uiController.optCancel.style.display = '';
    }

    this.speakNarration(narrationText, () => {
      this.guideFSM.transitionTo(GUIDE_STATES.WAITING_QUESTION);
      const qPrompt = this.language === 'en' ? 
        "This is how the process works for this step. Do you have any questions for me?" : 
        "Quy trình của bước này là như vậy. Bạn có câu hỏi nào cần tôi giải đáp không?";
      uiController.showDialogueBubble(
        speaker,
        qPrompt,
        {
          onContinue: () => {},
          onType: () => {},
          onVoice: () => {},
          onCancel: () => this.cancelFollow()
        }
      );
      uiController.optContinue.textContent = this.language === 'en' ? "Continue Journey" : "Tiếp tục hành trình";
      uiController.optContinue.style.display = '';
      uiController.optType.textContent = this.language === 'en' ? "Ask a Question (Type)" : "Đặt câu hỏi (Nhập)";
      uiController.optType.style.display = '';
      uiController.optVoice.textContent = this.language === 'en' ? "Ask with Voice" : "Hỏi bằng giọng nói";
      uiController.optVoice.style.display = '';
      if (uiController.optCancel) {
        uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
        uiController.optCancel.style.display = '';
      }
    }, this.language === 'en' ? `/audio/narration/step${this.currentStationIdx + 1}_en.wav` : `/audio/narration/step${this.currentStationIdx + 1}.wav`);
  }

  skipCurrentNarration() {
    // 1. Stop current audio
    if (this.guideFSM && this.guideFSM.answerAudio) {
      try {
        this.guideFSM.answerAudio.pause();
      } catch (err) {}
      this.guideFSM.answerAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    this.isSpeaking = false;

    // 2. Handle skip based on current state
    if (this.isWelcoming) {
      this.isWelcoming = false;
      if (this.hasArrivedAtFirstStation) {
        this.triggerStationArrival();
      } else {
        uiController.hideDialogueBubble();
      }
    } else if (this.currentStationIdx >= this.stations.length) {
      this.endTour();
    } else {
      // Station narration skip
      this.guideFSM.transitionTo(GUIDE_STATES.WAITING_QUESTION);
      const speaker = this.language === 'en' ? "Tour Guide" : "Hướng dẫn viên";
      const qPrompt = this.language === 'en' ? 
        "This is how the process works for this step. Do you have any questions for me?" : 
        "Quy trình của bước này là như vậy. Bạn có câu hỏi nào cần tôi giải đáp không?";
      uiController.showDialogueBubble(
        speaker,
        qPrompt,
        {
          onContinue: () => {},
          onType: () => {},
          onVoice: () => {},
          onCancel: () => this.cancelFollow()
        }
      );
      uiController.optContinue.textContent = this.language === 'en' ? "Continue Journey" : "Tiếp tục hành trình";
      uiController.optContinue.style.display = '';
      uiController.optType.textContent = this.language === 'en' ? "Ask a Question (Type)" : "Đặt câu hỏi (Nhập)";
      uiController.optType.style.display = '';
      uiController.optVoice.textContent = this.language === 'en' ? "Ask with Voice" : "Hỏi bằng giọng nói";
      uiController.optVoice.style.display = '';
      if (uiController.optCancel) {
        uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
        uiController.optCancel.style.display = '';
      }
    }
  }

  endTour() {
    this.playerState = PLAYER_STATES.FREE;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    this.isSpeaking = false;
    this.isWelcoming = false;
    this.hasArrivedAtFirstStation = false;

    if (this.guideFSM && this.guideFSM.answerAudio) {
      try {
        this.guideFSM.answerAudio.pause();
        this.guideFSM.answerAudio.currentTime = 0;
      } catch (err) {
        console.warn("Failed to stop narration audio:", err);
      }
      this.guideFSM.answerAudio = null;
    }

    uiController.hideProgress();
    uiController.hideDialogueBubble();
    uiController.showCancelNotice(false);
    uiController.showGuideAskBubble(false);
    
    this.guideFSM.transitionTo(GUIDE_STATES.IDLE);
    this.fadePlayerAction(this.playerActions.idle);
    
    // Reset checkpoint
    this.currentStationIdx = 0;
    
    // Let guide stand near the last station
    if (this.language === 'en') {
      uiController.showToast("Tour completed. Enjoy your exploration!");
    } else {
      uiController.showToast("Chuyến tham quan kết thúc. Chúc bạn khám phá vui vẻ!");
    }
  }

  cancelFollow() {
    this.playerState = PLAYER_STATES.FREE;
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    
    // Stop speech synthesis if speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.isWelcoming = false;
    this.hasArrivedAtFirstStation = false;

    if (this.guideFSM && this.guideFSM.answerAudio) {
      try {
        this.guideFSM.answerAudio.pause();
        this.guideFSM.answerAudio.currentTime = 0;
      } catch (err) {
        console.warn("Failed to stop narration audio:", err);
      }
      this.guideFSM.answerAudio = null;
    }
    
    // Stop guide movement, keep current position
    this.guideFSM.transitionTo(GUIDE_STATES.IDLE);
    this.fadePlayerAction(this.playerActions.idle);
    
    // Hide UI overlays
    uiController.hideProgress();
    uiController.hideDialogueBubble();
    uiController.showCancelNotice(false);
    
    // Show the box above the guide's head
    uiController.showGuideAskBubble(true);
    
    if (this.language === 'en') {
      uiController.showToast("Guided tour cancelled.");
    } else {
      uiController.showToast("Đã hủy theo hướng dẫn viên.");
    }

    const canvasElement = document.getElementById('museum-canvas') || document.querySelector('canvas');
    if (canvasElement && document.pointerLockElement !== canvasElement) {
      setTimeout(() => {
        canvasElement.requestPointerLock();
      }, 50);
    }
  }

  async speakNarration(text, callback, audioPath) {
    this.isSpeaking = true;
    try {
      let audioUrl = null;
      if (audioPath) {
        audioUrl = audioPath;
      } else {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'mock-default' })
        });
        if (!response.ok) throw new Error('TTS status not ok');
        const data = await response.json();
        audioUrl = data.audioUrl;
      }
      if (!audioUrl) throw new Error('No audioUrl for TTS');

      const audio = new Audio(audioUrl);
      const spoke = await this.guideFSM.playAnswerAudio(audio);
      if (spoke) {
        audio.addEventListener('ended', () => {
          this.isSpeaking = false;
          if (callback) callback();
        }, { once: true });
        return;
      }
      throw new Error('playAnswerAudio failed');
    } catch (err) {
      console.warn("Backend TTS failed or was blocked, falling back to Web Speech API:", err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.95;

        utterance.onend = () => {
          this.isSpeaking = false;
          if (callback) callback();
        };

        utterance.onerror = (e) => {
          console.error("Speech synthesis error, using timer fallback:", e);
          this.isSpeaking = false;
          const duration = Math.max(4000, text.length * 65);
          setTimeout(() => { if (callback) callback(); }, duration);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        this.isSpeaking = false;
        const duration = Math.max(4000, text.length * 65);
        setTimeout(() => { if (callback) callback(); }, duration);
      }
    }
  }


  nextStation() {
    this.currentStationIdx++;
    
    if (this.currentStationIdx >= this.stations.length) {
      // Final Thank You speech - Part 1: Sau Đó
      this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;
      this.guideFSM.transitionTo(GUIDE_STATES.TALKING);
      
      const afterTextVi = "Giấy dó thường được làm ở trong một số mùa nhất định khi thời tiết không mưa, không nắng quá, và không ẩm. Người dân Yên Thái hồi trước vừa là nông dân vừa là nghệ nhân làm giấy. Khi hết mùa làm nông, nghệ nhân sẽ chuyển sang làm giấy vì có thời gian. Học làm giấy không khó, chỉ mất một năm; nhưng để làm ra một tờ giấy chất lượng thì một người dân trong làng phải làm từ 5 đến 6 năm trở lên.";
      const afterTextEn = "Dó paper is usually made in certain seasons when the weather is not too rainy, not too sunny, and not humid. The people of Yen Thai village in the past were both farmers and paper-making artisans. When the agricultural season ended, they switched to making paper since they had time. Learning to make paper is not difficult, taking only a year; but to make a high-quality sheet of paper, a villager had to practice for 5 to 6 years or more.";
      const afterText = this.language === 'en' ? afterTextEn : afterTextVi;
      const speaker = this.language === 'en' ? "Tour Guide" : "Hướng dẫn viên";
      
      uiController.showDialogueBubble(speaker, afterText);
      uiController.optContinue.textContent = this.language === 'en' ? "Skip Narration" : "Bỏ qua thuyết minh";
      uiController.optContinue.style.display = '';
      uiController.optType.style.display = 'none';
      uiController.optVoice.style.display = 'none';
      if (uiController.optCancel) {
        uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
        uiController.optCancel.style.display = '';
      }

      this.speakNarration(afterText, () => {
        // Part 2: Kết Thúc
        const endTextVi = "Phần hướng dẫn của chúng mình đến đây là hết. Bạn có thể đi vòng quanh bảo tàng để xem những vật phẩm trưng bày của chúng mình, bao gồm những loại giấy dó, cây mò, liềm seo.";
        const endTextEn = "Here, our simulation journey has come to an end. Thank you very much for accompanying me. You can walk around the museum to view our exhibits, including types of Dó paper, the Mò tree, and the paper moulds.";
        const endText = this.language === 'en' ? endTextEn : endTextVi;
        uiController.showDialogueBubble(speaker, endText);
        
        uiController.optContinue.textContent = this.language === 'en' ? "Skip Narration" : "Bỏ qua thuyết minh";
        uiController.optContinue.style.display = '';
        uiController.optType.style.display = 'none';
        uiController.optVoice.style.display = 'none';
        if (uiController.optCancel) {
          uiController.optCancel.textContent = this.language === 'en' ? "Cancel" : "Hủy";
          uiController.optCancel.style.display = '';
        }

        this.speakNarration(endText, () => {
          setTimeout(() => {
            this.endTour();
            // Restore button displays for next potential run
            uiController.optContinue.style.display = '';
            uiController.optType.style.display = '';
            uiController.optVoice.style.display = '';
            if (uiController.optCancel) uiController.optCancel.style.display = '';
          }, 3000);
        }, this.language === 'en' ? '/audio/narration/end_en.wav' : '/audio/narration/end.wav');
      }, this.language === 'en' ? '/audio/narration/after_en.wav' : '/audio/narration/after.wav');
    } else {
      // Walk to next station
      const nextStation = this.stations[this.currentStationIdx];
      const stationName = this.language === 'en' ? (nextStation.nameEn || nextStation.name) : nextStation.name;
      uiController.showProgress(nextStation.stepNum, this.stations.length, stationName);
      uiController.hideDialogueBubble();
      
      this.playerState = PLAYER_STATES.FOLLOWING_GUIDE;
      this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
      this.fadePlayerAction(this.playerActions.walk);
    }
  }

  update(delta, time) {
    if (this.playerState === PLAYER_STATES.FREE) {
      if (this.guideTargetPos && this.guide) {
        const guidePos = this.guide.position;
        const targetXZ = new THREE.Vector3(this.guideTargetPos.x, guidePos.y, this.guideTargetPos.z);
        const dist = guidePos.distanceTo(targetXZ);

        if (dist > 0.15) {
          this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
          const dir = new THREE.Vector3().subVectors(targetXZ, guidePos).normalize();
          guidePos.x += dir.x * this.guideSpeed * delta;
          guidePos.z += dir.z * this.guideSpeed * delta;
          const targetAngle = Math.atan2(dir.x, dir.z);
          let diff = targetAngle - this.guide.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.guide.rotation.y += diff * Math.min(1, 10 * delta);
          if (this.guide.userData.groundY !== undefined) {
            guidePos.y = this.guide.userData.groundY;
          }
        } else {
          this.guideTargetPos = null;
          this.guideFSM.transitionTo(GUIDE_STATES.IDLE);
          const statusEl = document.getElementById('guide-arrival-status');
          if (statusEl) {
            statusEl.innerText = "Người hướng dẫn đã sẵn sàng giải đáp.";
          }
          const dirToPlayer = new THREE.Vector3().subVectors(this.player.position, guidePos).normalize();
          this.guide.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z);
        }
      }
      return;
    }

    const currentStation = this.stations[this.currentStationIdx];
    if (!currentStation) return;

    const guideStandPos = currentStation.guideStandPos;
    const guidePos = this.guide.position;

    // Force guide state to WALKING if we're in FOLLOWING_GUIDE but not yet at station
    if (this.playerState === PLAYER_STATES.FOLLOWING_GUIDE) {
      const distToStation = guidePos.distanceTo(new THREE.Vector3(guideStandPos.x, guidePos.y, guideStandPos.z));
      if (distToStation > 0.25) {
        this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
      }
    }

    if (this.guideFSM.currentState === GUIDE_STATES.WALKING) {
      const targetXZ = new THREE.Vector3(guideStandPos.x, guidePos.y, guideStandPos.z);
      const distToStation = guidePos.distanceTo(targetXZ);

      if (Math.random() < 0.01) {
        console.log(`[TourManager] WALKING - StationIdx: ${this.currentStationIdx}, Guide Pos: (${guidePos.x.toFixed(2)}, ${guidePos.z.toFixed(2)}), Target: (${targetXZ.x.toFixed(2)}, ${targetXZ.z.toFixed(2)}), Dist: ${distToStation.toFixed(2)}`);
      }

      if (distToStation > 0.25) {
        const dir = new THREE.Vector3().subVectors(targetXZ, guidePos).normalize();
        guidePos.x += dir.x * this.guideSpeed * delta;
        guidePos.z += dir.z * this.guideSpeed * delta;
        if (this.guide.userData.groundY !== undefined) {
          guidePos.y = this.guide.userData.groundY;
        }
        const targetAngle = Math.atan2(dir.x, dir.z);
        let diff = targetAngle - this.guide.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.guide.rotation.y += diff * Math.min(1, 10 * delta);
        this.fadePlayerAction(this.playerActions.walk);
      } else {
        // Arrived at station
        console.log(`[TourManager] ARRIVED - StationIdx: ${this.currentStationIdx}, Guide Pos: (${guidePos.x.toFixed(2)}, ${guidePos.z.toFixed(2)}), Target: (${targetXZ.x.toFixed(2)}, ${targetXZ.z.toFixed(2)})`);
        this.fadePlayerAction(this.playerActions.idle);
        this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;

        // Guide faces the PLAYER (not away from them)
        const dirToPlayer = new THREE.Vector3().subVectors(this.player.position, guidePos).normalize();
        this.guide.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z);

        if (this.isWelcoming) {
          // Stay in TALKING state showing the welcome bubble
          this.guideFSM.transitionTo(GUIDE_STATES.TALKING);
          this.hasArrivedAtFirstStation = true;
        } else {
          this.triggerStationArrival();
        }
      }
    }

    // Player auto-follow
    if (this.playerState === PLAYER_STATES.FOLLOWING_GUIDE || this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
      let targetPlayerPos;
      if (this.guideFSM.currentState === GUIDE_STATES.WALKING) {
        const guideForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.guide.quaternion).normalize();
        targetPlayerPos = new THREE.Vector3()
          .copy(guidePos)
          .addScaledVector(guideForward, -this.playerFollowDistance);
      } else {
        targetPlayerPos = new THREE.Vector3().copy(currentStation.playerStandPos);
      }

      targetPlayerPos.y = this.player.position.y;
      const distToFollowTarget = this.player.position.distanceTo(targetPlayerPos);

      if (distToFollowTarget > 0.15) {
        const pDir = new THREE.Vector3().subVectors(targetPlayerPos, this.player.position).normalize();
        const pSpeed = Math.min(this.guideSpeed * 1.1, distToFollowTarget * 4);
        this.player.position.addScaledVector(pDir, pSpeed * delta);
        const pTargetAngle = Math.atan2(pDir.x, pDir.z);
        let pDiff = pTargetAngle - this.player.rotation.y;
        while (pDiff > Math.PI) pDiff -= Math.PI * 2;
        while (pDiff < -Math.PI) pDiff += Math.PI * 2;
        this.player.rotation.y += pDiff * Math.min(1, 10 * delta);
        this.fadePlayerAction(this.playerActions.walk);
      } else {
        this.fadePlayerAction(this.playerActions.idle);
        if (this.guideFSM.currentState === GUIDE_STATES.TALKING || this.guideFSM.currentState === GUIDE_STATES.WAITING_QUESTION) {
          // Guide faces the player continuously
          const guideDirToPlayer = new THREE.Vector3().subVectors(this.player.position, guidePos).normalize();
          const guideTargetAngle = Math.atan2(guideDirToPlayer.x, guideDirToPlayer.z);
          let guideDiff = guideTargetAngle - this.guide.rotation.y;
          while (guideDiff > Math.PI) guideDiff -= Math.PI * 2;
          while (guideDiff < -Math.PI) guideDiff += Math.PI * 2;
          this.guide.rotation.y += guideDiff * Math.min(1, 10 * delta);

          // Player faces the screen
          const pDirToScreen = new THREE.Vector3().subVectors(currentStation.lookPos, this.player.position).normalize();
          const pTargetAngle = Math.atan2(pDirToScreen.x, pDirToScreen.z);
          let pDiff = pTargetAngle - this.player.rotation.y;
          while (pDiff > Math.PI) pDiff -= Math.PI * 2;
          while (pDiff < -Math.PI) pDiff += Math.PI * 2;
          this.player.rotation.y += pDiff * Math.min(1, 10 * delta);
        }
      }
    }

    // First Person Camera Tracking
    const headPos = new THREE.Vector3().copy(this.player.position).add(new THREE.Vector3(0, 1.3, 0));
    this.camera.position.copy(headPos);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.controls.target.copy(headPos).addScaledVector(dir, 0.05);

    if (this.playerMixer) {
      // Disabled player mixer update in first-person
    }
  }

  requestContextualHelp(playerPos) {
    if (!this.guide) return;
    
    // Prevent starting several movement requests simultaneously
    if (this.guideTargetPos) return;
    
    const dist = this.guide.position.distanceTo(playerPos);
    
    // Set appropriate speed based on distance thresholds
    if (dist < 10.0) {
      this.guideSpeed = 1.8;
    } else if (dist < 20.0) {
      this.guideSpeed = 3.2;
    } else {
      this.guideSpeed = 4.5;
    }
    
    // Calculate safe conversational position target (2.2m from player in direction of guide)
    const dir = new THREE.Vector3().subVectors(this.guide.position, playerPos).normalize();
    dir.y = 0;
    const target = new THREE.Vector3().copy(playerPos).addScaledVector(dir, 2.2);
    
    // Clamp to museum boundaries to prevent going out of walls
    target.x = Math.max(-9.0, Math.min(9.0, target.x));
    target.z = Math.max(-33.0, Math.min(33.0, target.z));
    
    this.guideTargetPos = target;
    
    // Set status bar to "Người hướng dẫn đang tới..."
    const statusEl = document.getElementById('guide-arrival-status');
    if (statusEl) {
      statusEl.innerText = "Người hướng dẫn đang tới...";
    }
  }
}
