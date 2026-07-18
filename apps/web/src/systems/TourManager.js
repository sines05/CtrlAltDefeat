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
    
    // Save original camera target/distance settings to restore after tour
    this.originalTarget = new THREE.Vector3().copy(controls.target);
    
    this.setupUIEvents();
  }

  setupUIEvents() {
    // When the user clicks the "Continue" option on the dialogue bubble
    const originalContinue = uiController.optContinue.onclick;
    uiController.optContinue.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.nextStation();
      }
    });

    uiController.optType.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.playerState = PLAYER_STATES.QUESTION_INPUT;
        uiController.openTypingModal();
      }
    });

    uiController.optVoice.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
        this.playerState = PLAYER_STATES.QUESTION_VOICE;
        uiController.openVoiceModal();
      }
    });

    // Handle close/cancel actions to return to WATCHING_DIALOGUE state
    uiController.typingCancel.addEventListener('click', () => {
      this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;
    });
    uiController.typingSend.addEventListener('click', () => {
      this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;
    });
    uiController.voiceClose.addEventListener('click', () => {
      this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;
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

  startTour() {
    this.playerState = PLAYER_STATES.FOLLOWING_GUIDE;
    uiController.showFollowButton(false);
    
    // Show cancel notice and hide head bubble
    uiController.showCancelNotice(true);
    uiController.showGuideAskBubble(false);

    const currentStation = this.stations[this.currentStationIdx];
    uiController.showProgress(currentStation.stepNum, this.stations.length, currentStation.name);
    
    // Start guide walking
    this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
    
    // Save original controls target
    this.originalTarget.copy(this.controls.target);
    
    // Play initial walking for player
    this.fadePlayerAction(this.playerActions.walk);
  }

  endTour() {
    this.playerState = PLAYER_STATES.FREE;
    uiController.hideProgress();
    uiController.hideDialogueBubble();
    uiController.showCancelNotice(false);
    uiController.showGuideAskBubble(false);
    
    this.guideFSM.transitionTo(GUIDE_STATES.IDLE);
    this.fadePlayerAction(this.playerActions.idle);
    
    // Reset checkpoint
    this.currentStationIdx = 0;
    
    // Let guide stand near the last station
    uiController.showToast("Chuyến tham quan kết thúc. Chúc bạn khám phá vui vẻ!");
  }

  cancelFollow() {
    this.playerState = PLAYER_STATES.FREE;
    
    // Stop speech synthesis if speaking
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    
    // Stop guide movement, keep current position
    this.guideFSM.transitionTo(GUIDE_STATES.IDLE);
    this.fadePlayerAction(this.playerActions.idle);
    
    // Hide UI overlays
    uiController.hideProgress();
    uiController.hideDialogueBubble();
    uiController.showCancelNotice(false);
    
    // Show the box above the guide's head
    uiController.showGuideAskBubble(true);
    
    uiController.showToast("Đã hủy theo hướng dẫn viên.");
  }

  speakNarration(text, callback) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.95; // slightly slower for premium tone
      
      utterance.onend = () => {
        this.isSpeaking = false;
        if (callback) callback();
      };
      
      utterance.onerror = (e) => {
        console.error("Speech synthesis error, using timer fallback:", e);
        this.isSpeaking = false;
        // Fallback timer based on character length
        const duration = Math.max(4000, text.length * 65);
        setTimeout(() => { if (callback) callback(); }, duration);
      };
      
      this.isSpeaking = true;
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback if speechSynthesis is not available
      const duration = Math.max(4000, text.length * 65);
      setTimeout(() => { if (callback) callback(); }, duration);
    }
  }

  nextStation() {
    this.currentStationIdx++;
    
    if (this.currentStationIdx >= this.stations.length) {
      // Final Thank You speech
      this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;
      this.guideFSM.transitionTo(GUIDE_STATES.TALKING);
      
      const thankYouText = "Cảm ơn bạn đã đồng hành cùng tôi trong chuyến tham quan quy trình làm giấy Dó truyền thống. Hãy tự do khám phá thêm nhé!";
      uiController.showDialogueBubble("Hướng dẫn viên", thankYouText);
      uiController.optContinue.style.display = 'none';
      uiController.optType.style.display = 'none';
      uiController.optVoice.style.display = 'none';

      this.speakNarration(thankYouText, () => {
        setTimeout(() => {
          this.endTour();
          // Restore button displays for next potential run
          uiController.optContinue.style.display = '';
          uiController.optType.style.display = '';
          uiController.optVoice.style.display = '';
        }, 3000);
      });
    } else {
      // Walk to next station
      const nextStation = this.stations[this.currentStationIdx];
      uiController.showProgress(nextStation.stepNum, this.stations.length, nextStation.name);
      uiController.hideDialogueBubble();
      
      this.playerState = PLAYER_STATES.FOLLOWING_GUIDE;
      this.guideFSM.transitionTo(GUIDE_STATES.WALKING);
      this.fadePlayerAction(this.playerActions.walk);
    }
  }

  update(delta, time) {
    if (this.playerState === PLAYER_STATES.FREE) {
      // Check distance to guide to show Follow Button
      if (this.player && this.guide) {
        const dist = this.player.position.distanceTo(this.guide.position);
        if (dist < 2.5) {
          uiController.showFollowButton(true, () => this.startTour());
        } else {
          uiController.showFollowButton(false);
        }
      }
      return;
    }

    const currentStation = this.stations[this.currentStationIdx];
    if (!currentStation) return;

    const guideStandPos = currentStation.guideStandPos;
    const guidePos = this.guide.position;

    if (this.guideFSM.currentState === GUIDE_STATES.WALKING) {
      // 1a. Move guide strictly in X-Z plane, ignoring vertical coordinate to prevent sinking or floating
      const targetXZ = new THREE.Vector3(guideStandPos.x, guidePos.y, guideStandPos.z);
      const distToStation = guidePos.distanceTo(targetXZ);

      if (distToStation > 0.25) {
        const dir = new THREE.Vector3().subVectors(targetXZ, guidePos).normalize();
        
        // Update X-Z position only
        guidePos.x += dir.x * this.guideSpeed * delta;
        guidePos.z += dir.z * this.guideSpeed * delta;
        
        // Keep vertical height locked exactly to the grounded height
        guidePos.y = this.guide.userData.groundY !== undefined ? this.guide.userData.groundY : guidePos.y;
        
        // Rotate guide to face target
        const targetAngle = Math.atan2(dir.x, dir.z);
        let diff = targetAngle - this.guide.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.guide.rotation.y += diff * Math.min(1, 10 * delta);
        
        this.fadePlayerAction(this.playerActions.walk);
      } else {
        // Arrived at station! Turn to look at screen
        this.guideFSM.transitionTo(GUIDE_STATES.TALKING);
        this.fadePlayerAction(this.playerActions.idle);
        this.playerState = PLAYER_STATES.WATCHING_DIALOGUE;

        // Rotate guide to face player
        const dirToPlayer = new THREE.Vector3().subVectors(this.player.position, this.guide.position).normalize();
        this.guide.rotation.y = Math.atan2(dirToPlayer.x, dirToPlayer.z);

        // Hide options buttons while narration is playing
        uiController.optContinue.style.display = 'none';
        uiController.optType.style.display = 'none';
        uiController.optVoice.style.display = 'none';
        
        // Show narration text in dialogue bubble
        uiController.showDialogueBubble("Hướng dẫn viên", currentStation.narration);

        // Speak the narration text
        this.speakNarration(currentStation.narration, () => {
          // Speak complete. Transition FSM to WAITING_QUESTION
          this.guideFSM.transitionTo(GUIDE_STATES.WAITING_QUESTION);
          
          // Re-show options and show "Do you have any questions?"
          uiController.showDialogueBubble(
            "Hướng dẫn viên", 
            "Quy trình của bước này là như vậy. Bạn có câu hỏi nào cần tôi giải đáp không?", 
            {
              onContinue: () => {}, // Handled by addEventListener in constructor
              onType: () => {},
              onVoice: () => {}
            }
          );
          
          uiController.optContinue.style.display = '';
          uiController.optType.style.display = '';
          uiController.optVoice.style.display = '';
        });
      }
    }

    // 2. Manage Player Auto-follow behind guide
    if (this.playerState === PLAYER_STATES.FOLLOWING_GUIDE || this.playerState === PLAYER_STATES.WATCHING_DIALOGUE) {
      let targetPlayerPos;
      if (this.guideFSM.currentState === GUIDE_STATES.WALKING) {
        // Calculate target position 1.5m behind the guide's movement direction
        const guideForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.guide.quaternion).normalize();
        targetPlayerPos = new THREE.Vector3()
          .copy(guidePos)
          .addScaledVector(guideForward, -this.playerFollowDistance);
      } else {
        // Target is static player stand pos for current station (in front of the screen)
        targetPlayerPos = new THREE.Vector3().copy(currentStation.playerStandPos);
      }
      
      targetPlayerPos.y = this.player.position.y; // Keep vertical alignment

      const distToFollowTarget = this.player.position.distanceTo(targetPlayerPos);

      if (distToFollowTarget > 0.15) {
        // Move player towards follow point
        const pDir = new THREE.Vector3().subVectors(targetPlayerPos, this.player.position).normalize();
        const pSpeed = Math.min(this.guideSpeed * 1.1, distToFollowTarget * 4); // smooth ease
        this.player.position.addScaledVector(pDir, pSpeed * delta);

        // Rotate player to face the guide or target
        const pTargetAngle = Math.atan2(pDir.x, pDir.z);
        let pDiff = pTargetAngle - this.player.rotation.y;
        while (pDiff > Math.PI) pDiff -= Math.PI * 2;
        while (pDiff < -Math.PI) pDiff += Math.PI * 2;
        this.player.rotation.y += pDiff * Math.min(1, 10 * delta);

        this.fadePlayerAction(this.playerActions.walk);
      } else {
        // Arrived at standing position
        this.fadePlayerAction(this.playerActions.idle);
        
        // If stationary at station, make player face the screen and guide face the player
        if (this.guideFSM.currentState === GUIDE_STATES.TALKING || this.guideFSM.currentState === GUIDE_STATES.WAITING_QUESTION) {
          // Make guide face the player
          const dirToPlayer = new THREE.Vector3().subVectors(this.player.position, this.guide.position).normalize();
          const guideTargetAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z);
          let gDiff = guideTargetAngle - this.guide.rotation.y;
          while (gDiff > Math.PI) gDiff -= Math.PI * 2;
          while (gDiff < -Math.PI) gDiff += Math.PI * 2;
          this.guide.rotation.y += gDiff * Math.min(1, 10 * delta);

          // Make player face the screen
          const pDirToScreen = new THREE.Vector3().subVectors(currentStation.lookPos, this.player.position).normalize();
          const pTargetAngle = Math.atan2(pDirToScreen.x, pDirToScreen.z);
          let pDiff = pTargetAngle - this.player.rotation.y;
          while (pDiff > Math.PI) pDiff -= Math.PI * 2;
          while (pDiff < -Math.PI) pDiff += Math.PI * 2;
          this.player.rotation.y += pDiff * Math.min(1, 10 * delta);
        }
      }
    }

    // 3. First Person Camera Tracking
    const headPos = new THREE.Vector3().copy(this.player.position).add(new THREE.Vector3(0, 1.3, 0));
    
    // Position camera exactly at player's head
    this.camera.position.copy(headPos);

    // Keep player's current camera direction, allowing them to look around
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.controls.target.copy(headPos).addScaledVector(dir, 0.05);

    // Update mixers
    if (this.playerMixer) {
      // Disabled player mixer update in first-person to save CPU/GPU skinning costs
      // this.playerMixer.update(delta);
    }
  }
}
