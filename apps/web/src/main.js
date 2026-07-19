/**
 * @file main.js
 * @description Frontend entry point driving the immersive 3D museum corridor and guide interactions.
 *
 * SYSTEM ENTRYPOINT & CLIENT-SIDE ARCHITECTURE SPECIFICATION:
 * - Core Design Rationale: Traditional heritage preservation (such as Vietnamese Dó papermaking) has historically
 *   been restricted to static exhibits that struggle to capture the interest of modern and international visitors.
 *   Dó.AI resolves this engagement bottleneck by implementing a multisensory "living museum" paradigm directly
 *   within a web interface.
 * - Edge-Computing Transcoding Pipeline: To bridge the gap between browser audio capture (WebM Opus/AAC) and the
 *   strict raw PCM requirements of real-time multi-modal LLM APIs, the system decodes and resamples audio files
 *   to exactly 16000Hz mono dynamically on the client side using decodeAudioData and OfflineAudioContext. This avoids
 *   heavy backend transcription server overhead, limits data payload transit, and optimizes mobile device battery life.
 * - Resource Lifecycle & Gestures: Manages a unified AudioContext pool (sharedAudioCtx) to circumvent browser limits
 *   on concurrent audio channels. The initialization is deferred behind a Landing Page user gesture to satisfy browser
 *   autoplay requirements and ensure smooth, crash-free preloading of 3D WebGL assets.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { createMuseumCorridor, updateCeilingFans } from './components/MuseumCorridor.js';
import { createExhibitionWall } from './components/ExhibitionWall/ExhibitionWall.js';
import { CharacterGrounding } from './systems/CharacterGrounding.js';
import { GuideFSM, GUIDE_STATES } from './systems/GuideFSM.js';
import { TourManager, PLAYER_STATES } from './systems/TourManager.js';
import { uiController } from './systems/UIController.js';
import { VideoActivationSystem } from './systems/VideoActivationSystem/VideoActivationSystem.js';
import { Plaque } from './components/Plaque/Plaque.js';
import { PRODUCT_EXHIBIT } from './data/productData.js';
import { MORTAR_EXHIBIT } from './data/mortarData.js';
import { PAPER_EXHIBIT } from './data/paperData.js';
import { WOODEN_MOULD_EXHIBIT } from './data/woodenMouldData.js';
import { HISTORICAL_PAPER_EXHIBIT } from './data/historicalPaperData.js';
import { DRYING_RACK_EXHIBIT } from './data/dryingRackData.js';
import { PRINTING_DISPLAY_EXHIBIT } from './data/printingDisplayData.js';
import { VILLAGE_DIORAMA_EXHIBIT } from './data/villageDioramaData.js';
import { createFourNewExhibits } from './components/FourNewExhibits.js';
import { fetchBootstrapContent } from './media/client.js';
import { adaptMediaManifest, createDegradedMediaState } from './media/manifest-adapter.js';
import { createModelRegistry } from './media/model-registry.js';
import { readLiveCapability, submitQuestionTurn } from './qa/live-client.js';

const SCENE_ID = 'tay-ho-giay-do-room-01';
const TOUR_ID = 'tour-01';
const SCENE_PROP_ACTIVATION_DISTANCE = 12;
const SCENE_PROP_TARGETS = [
  { role: 'exhibit-village-picture', activationZ: -18 },
  { role: 'exhibit-product-showing', activationZ: -9 },
  { role: 'exhibit-paper-showing', activationZ: -6 },
  { role: 'exhibit-mortar', activationZ: 0 },
  { role: 'exhibit-showing-tree', activationZ: 9 },
  { role: 'exhibit-wooden-mould', activationZ: 18 },
];
const GUIDE_PROMOTION_ROLES = ['guide-model', 'guide-idle', 'guide-walk', 'guide-talk'];
const LANDING_PRELOAD_GUIDE_ROLES = ['guide-model', 'guide-idle'];

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let clock = null;
let videoActivationSystem = null;
let character = null;
let currentAction = null;
let isTalking = false;
let mixers = [];
let tourManager = null;
let stations = [];
let modelRegistry = null;
let runtimeStarted = false;
let runtimeStartPromise = null;
let runtimeEventsBound = false;
let animationStarted = false;
let approvedBootstrapPromise = null;
let guidePromotionLoad = null;
let approvedMediaApplied = false;
let bootstrapState = {
  scene: null,
  tour: null,
  media: createDegradedMediaState({ sceneId: SCENE_ID }),
};

const sceneProps = new Map();
const scenePropLoadPromises = new Map();
const loadedScenePropRoles = new Set();
let liveCapability = {
  enabled: false,
  model: 'gemini-3.1-flash-live-preview',
};

// Voice is an access layer over approved museum content, not a second truth source.
// The guide can speak answers more naturally, but the answer contract still comes from
// the same grounded QA / TTS pipeline that protects the cultural facts underneath.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read recorded audio.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

async function presentGuideAnswer(turn) {
  // The dialogue bubble is the non-negotiable path: even if autoplay, TTS, or Live audio
  // degrades, the visitor still gets a readable grounded answer instead of a silent failure.
  const answer = turn?.qaPacket?.answer ?? turn?.ttsState?.outputTranscript ?? '';
  if (!answer) {
    uiController.showToast(turn?.ttsState?.recoveryMessage ?? 'Không nhận được câu trả lời.');
    return;
  }

  uiController.showDialogueBubble('Hướng dẫn viên', answer);
  const audioUrl = turn.ttsState?.audioUrl;
  if (!audioUrl || !tourManager?.guideFSM) {
    return;
  }

  const spoke = await tourManager.guideFSM.playAnswerAudio(new Audio(audioUrl));
  if (!spoke) {
    uiController.showToast('Không thể tự phát audio; câu trả lời vẫn hiển thị.');
  }
}

async function submitGuideTurn({ question = '', audio = null } = {}) {
  uiController.showToast('Hướng dẫn viên đang trả lời…');

  try {
    const turn = await submitQuestionTurn({
      sceneId: SCENE_ID,
      capability: liveCapability,
      question,
      audio,
    });
    await presentGuideAnswer(turn);
  } catch (error) {
    console.warn('[GuideVoice] Question turn failed.', error);
    uiController.showToast('Không thể trả lời ngay lúc này. Hãy thử lại.');
  }
}

let canvas = null;
let isPointerLocked = false;
let videosBlessed = false;

function blessVideos() {
  if (stations && stations.length > 0) {
    stations.forEach(station => {
      const video = station.videoDisplay?.video;
      if (video && video.paused) {
        video.play().then(() => {
          video.pause();
        }).catch(err => {
          console.warn("[VideoDisplay] Blessing failed:", err.message);
        });
      }
    });
  }
}

function bindFPSPointerLockEvents(canvasElement) {
  canvasElement.addEventListener('click', () => {
    if (document.pointerLockElement !== canvasElement) {
      canvasElement.requestPointerLock();
    }
    if (!videosBlessed) {
      blessVideos();
      videosBlessed = true;
    }
  });

  const followBtn = document.getElementById('follow-btn');
  if (followBtn) {
    followBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (document.pointerLockElement !== canvasElement) {
          canvasElement.requestPointerLock();
        }
      }, 50);
    });
  }

  const optContinue = document.getElementById('opt-continue');
  if (optContinue) {
    optContinue.addEventListener('click', () => {
      setTimeout(() => {
        if (document.pointerLockElement !== canvasElement) {
          canvasElement.requestPointerLock();
        }
      }, 50);
    });
  }

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvasElement) {
      isPointerLocked = true;
      if (controls) controls.enabled = false;
    } else {
      isPointerLocked = false;
      if (controls) {
        controls.enabled = true;
        // Sync OrbitControls target when exiting pointer lock
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const headPos = new THREE.Vector3().copy(character ? character.position : camera.position).add(new THREE.Vector3(0, 1.3, 0));
        controls.target.copy(headPos).addScaledVector(dir, 0.05);
        controls.update();
      }
    }
  });

  const lookSensitivity = 0.002;
  document.addEventListener('mousemove', (e) => {
    if (!isPointerLocked || !camera) return;

    camera.rotation.y -= e.movementX * lookSensitivity;
    camera.rotation.x -= e.movementY * lookSensitivity;

    // Clamp vertical look to -80 / +80 degrees to prevent flipping upside down
    const maxPitch = Math.PI / 2.25;
    camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x));
  });
}

function checkUIAndUnlock() {
  const isUIOpen = 
    (document.getElementById('dialogue-bubble') && document.getElementById('dialogue-bubble').classList.contains('visible')) ||
    (document.getElementById('typing-modal') && document.getElementById('typing-modal').classList.contains('visible')) ||
    (document.getElementById('voice-modal') && document.getElementById('voice-modal').classList.contains('visible')) ||
    (document.getElementById('plaque-modal') && document.getElementById('plaque-modal').classList.contains('visible')) ||
    (document.getElementById('village-modal') && document.getElementById('village-modal').classList.contains('visible')) ||
    (document.getElementById('product-modal') && document.getElementById('product-modal').classList.contains('visible')) ||
    (document.getElementById('mortar-modal') && document.getElementById('mortar-modal').classList.contains('visible')) ||
    (document.getElementById('paper-modal') && document.getElementById('paper-modal').classList.contains('visible')) ||
    (document.getElementById('wooden-mould-modal') && document.getElementById('wooden-mould-modal').classList.contains('visible')) ||
    (document.getElementById('pedestal-modal') && document.getElementById('pedestal-modal').classList.contains('visible')) ||
    (document.getElementById('drying-modal') && document.getElementById('drying-modal').classList.contains('visible')) ||
    (document.getElementById('printing-modal') && document.getElementById('printing-modal').classList.contains('visible')) ||
    (document.getElementById('diorama-modal') && document.getElementById('diorama-modal').classList.contains('visible')) ||
    (document.getElementById('gfx-warning-modal') && document.getElementById('gfx-warning-modal').classList.contains('visible'));
  
  if (isUIOpen && canvas && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function ensureRuntimeShell() {
  if (scene) {
    return;
  }

  const nextScene = new THREE.Scene();
  const nextCamera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  nextCamera.position.set(0, 3, -35); // Start closer to the entrance walkway
  nextCamera.rotation.order = 'YXZ'; // Set rotation order for FPS look controls
  nextScene.add(nextCamera); // Ensure camera children (arms) are rendered

  const nextRenderer = new THREE.WebGLRenderer({ antialias: false });
  nextRenderer.setSize(innerWidth, innerHeight);
  nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
  nextRenderer.shadowMap.enabled = true;
  nextRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  nextRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  nextRenderer.toneMappingExposure = 1.75;
  nextRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const nextControls = new OrbitControls(nextCamera, nextRenderer.domElement);
  nextControls.target.set(0, 1.3, -32);
  nextControls.enableDamping = false;
  nextControls.rotateSpeed = 0.45;
  nextControls.minDistance = 0.01;
  nextControls.maxDistance = 0.1;
  nextControls.enableZoom = false;
  nextControls.enablePan = false;
  nextControls.maxPolarAngle = Math.PI / 1.9;
  nextControls.minPolarAngle = Math.PI / 3.0;
  nextControls.update();

  const sunLight = new THREE.DirectionalLight(0xffe2ab, 2.2);
  sunLight.position.set(10, 15, -10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 40;
  sunLight.shadow.camera.left = -8;
  sunLight.shadow.camera.right = 8;
  sunLight.shadow.camera.top = 8;
  sunLight.shadow.camera.bottom = -8;
  sunLight.shadow.bias = -0.0005;
  nextScene.add(sunLight);

  document.body.prepend(nextRenderer.domElement);
  scene = nextScene;
  camera = nextCamera;
  renderer = nextRenderer;
  controls = nextControls;
  clock = new THREE.Clock();

  // Initialize canvas reference and bind pointerlock/FPS controls
  canvas = nextRenderer.domElement;
  bindFPSPointerLockEvents(canvas);
}

function resetRuntimeShell() {
  disposeStations(stations);
  controls?.dispose?.();
  renderer?.domElement?.remove();
  renderer?.dispose?.();
  sceneProps.clear();
  scenePropLoadPromises.clear();
  loadedScenePropRoles.clear();
  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  clock = null;
  videoActivationSystem = null;
  character = null;
  currentAction = null;
  mixers = [];
  tourManager = null;
  stations = [];
  runtimeStarted = false;
  animationStarted = false;
  approvedMediaApplied = false;
  didSignalFirstFrame = false;
  canvas = null;
  isPointerLocked = false;
  videosBlessed = false;
}

let plaque;
let villagePictureGroup;
let productGroup;
let mortarGroup;
let paperGroup;
let woodenMouldGroup;
let pedestalGroup;
let dryingGroup;
let printingGroup;
let dioramaGroup;
let guidePanel = null; // null | 'proximity-menu' | 'qa-placeholder' | 'tour-confirmation'
const GUIDE_PROXIMITY_RANGE = 2.5;

const keys = { w: false, a: false, s: false, d: false, ' ': false };
const velocity = new THREE.Vector3();
const acceleration = 22;
const maxSpeed = 4.5;
const friction = 25;

function removeLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (!loadingScreen) {
    return;
  }

  loadingScreen.classList.add('fade-out');
  setTimeout(() => loadingScreen.remove(), 500);
}

function waitForNextFrame() {
  const scheduleFrame = globalThis.requestAnimationFrame ?? ((callback) => setTimeout(callback, 0));
  return new Promise((resolve) => scheduleFrame(() => resolve()));
}

function adjustSingleMaterial(mat) {
  if (mat.isMeshBasicMaterial) {
    return new THREE.MeshStandardMaterial({
      map: mat.map,
      color: mat.color ? mat.color.clone().multiplyScalar(1.0) : new THREE.Color(0xcccccc),
      roughness: 0.85,
      metalness: 0.05,
    });
  }

  if (mat.emissive) mat.emissive.setHex(0x000000);
  if (mat.specular) mat.specular.setHex(0x111111);
  if (mat.shininess !== undefined) mat.shininess = 5;
  if (mat.color) {
    mat.color.multiplyScalar(1.0);
  }
  if (mat.roughness !== undefined) mat.roughness = 0.85;
  if (mat.metalness !== undefined) mat.metalness = 0.05;

  return mat;
}

function fixModelMaterials(model, receiveShadow = true) {
  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = receiveShadow;

    if (!child.material) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map((mat) => adjustSingleMaterial(mat))
      : adjustSingleMaterial(child.material);
  });
}

function autoScaleAndGround(model, targetHeight) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  if (size.y > 0) {
    const scale = targetHeight / size.y;
    model.scale.set(scale, scale, scale);
  }

  CharacterGrounding.ground(model);
}

function prepareAsset(model, receiveShadow = true) {
  const lightsToRemove = [];
  model.traverse((child) => {
    if (child.isLight || child.isCamera) {
      lightsToRemove.push(child);
    }
  });
  lightsToRemove.forEach((light) => {
    light.parent?.remove(light);
  });

  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    child.castShadow = true;
    child.receiveShadow = receiveShadow;
    if (!child.material) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map((mat) => mat.clone())
      : child.material.clone();
  });
}

function createMockAction() {
  return {
    play() {},
    reset() {
      return this;
    },
    fadeIn() {
      return this;
    },
    fadeOut() {},
    setEffectiveWeight() {},
  };
}
function removeSceneObject(object3d) {
  if (!object3d) {
    return;
  }

  object3d.parent?.remove(object3d);
}

function disposeStations(stationList) {
  for (const station of stationList) {
    removeSceneObject(station.group);
    station.dispose?.();
  }
}

function rebuildStations(stationViewModels) {
  disposeStations(stations);
  stations = createExhibitionWall(scene, stationViewModels);
  videoActivationSystem = new VideoActivationSystem(stations);

  if (tourManager) {
    tourManager.stations = stations;
    tourManager.currentStationIdx = Math.min(tourManager.currentStationIdx, Math.max(stations.length - 1, 0));
  }
}

function registerSceneProp(role, object3d) {
  removeSceneObject(sceneProps.get(role));
  sceneProps.set(role, object3d);
  return object3d;
}

function createFallbackCharacters() {
  const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8);
  const playerModel = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x44aaff }));
  playerModel.position.set(0, 0, -32);
  playerModel.castShadow = false;
  playerModel.receiveShadow = false;
  playerModel.visible = false;
  scene.add(playerModel);
  CharacterGrounding.ground(playerModel);

  const guideModel = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffaa44 }));
  guideModel.position.set(-1.5, 0, -28);
  guideModel.castShadow = true;
  guideModel.receiveShadow = false;
  scene.add(guideModel);
  CharacterGrounding.ground(guideModel, -0.92);

  const mockActions = {
    idle: createMockAction(),
    walk: createMockAction(),
    talk: createMockAction(),
  };
  playerModel.userData.actions = mockActions;
  currentAction = mockActions.idle;
  character = playerModel;

  return {
    playerModel,
    guideModel,
    guideFSM: new GuideFSM(guideModel, null, mockActions),
    mockActions,
  };
}

function createFallbackSceneProps() {
  const productFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 }),
  );
  productFallback.position.set(2.5, 0, -9.0);
  scene.add(productFallback);
  CharacterGrounding.ground(productFallback);
  registerSceneProp('exhibit-product-showing', productFallback);

  const treeFallback = new THREE.Group();
  treeFallback.position.set(2.5, 0, 9.0);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 }),
  );
  trunk.position.y = 0.4;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d7044, roughness: 0.9 }),
  );
  leaves.position.y = 1.9;
  treeFallback.add(trunk, leaves);
  scene.add(treeFallback);
  CharacterGrounding.ground(treeFallback);
  registerSceneProp('exhibit-showing-tree', treeFallback);

  const pictureFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.4, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.6 }),
  );
  pictureFallback.position.set(10.75, 2.2, -18.0);
  scene.add(pictureFallback);
  villagePictureGroup = pictureFallback;
  registerSceneProp('exhibit-village-picture', pictureFallback);
  const mortarFallback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d8072, roughness: 0.85 }),
  );
  mortarFallback.position.set(5.5, 0, -3.5);
  scene.add(mortarFallback);
  CharacterGrounding.ground(mortarFallback);
  mortarGroup = mortarFallback;
  registerSceneProp('exhibit-mortar', mortarFallback);
  const paperFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.2, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd4c9a8, roughness: 0.5 }),
  );
  paperFallback.position.set(10.95, 2.2, -6.0);
  scene.add(paperFallback);
  paperGroup = paperFallback;
  registerSceneProp('exhibit-paper-showing', paperFallback);
  const mouldFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 }),
  );
  mouldFallback.position.set(4.0, 0.6, 18.0);
  scene.add(mouldFallback);
  woodenMouldGroup = mouldFallback;

  // Fallback for cabin: a large wooden cabin-like box
  const cabinFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 })
  );
  cabinFallback.position.set(1.5, 0, 0.0);
  scene.add(cabinFallback);
  CharacterGrounding.ground(cabinFallback);

  // Fallback for product_showing_02: a cylinder/box
  const product02Fallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.2, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.7 })
  );
  product02Fallback.position.set(2.5, 0, 24.0);
  scene.add(product02Fallback);
  CharacterGrounding.ground(product02Fallback);
  productGroup = product02Fallback;

  // Fallback for plaque
  plaque = new Plaque(8.0, -12.0, -Math.PI / 2);
  scene.add(plaque.group);

  // Fallback four new exhibits
  const newExhibitsData = createFourNewExhibits(scene);
  newExhibitsData.forEach(ex => {
    if (ex.id === 'historical_paper_pedestal') pedestalGroup = { position: ex.position };
    else if (ex.id === 'traditional_paper_drying_rack') dryingGroup = { position: ex.position };
    else if (ex.id === 'do_paper_printing_display') printingGroup = { position: ex.position };
    else if (ex.id === 'yen_thai_village_diorama') dioramaGroup = { position: ex.position };
  });
  registerSceneProp('exhibit-wooden-mould', mouldFallback);
}
function placeProductShowingModel(productShowingModel) {
  prepareAsset(productShowingModel, true);
  productShowingModel.position.set(2.5, 0, -9.0);
  scene.add(productShowingModel);
  autoScaleAndGround(productShowingModel, 2.0);
  return registerSceneProp('exhibit-product-showing', productShowingModel);
}

function placeShowingTreeModel(showingTreeModel) {
  prepareAsset(showingTreeModel, true);
  showingTreeModel.position.set(2.5, 0, 9.0);
  scene.add(showingTreeModel);
  autoScaleAndGround(showingTreeModel, 2.8);
  return registerSceneProp('exhibit-showing-tree', showingTreeModel);
}

function placeVillagePictureModel(villagePictureModel) {
  prepareAsset(villagePictureModel, false);

  const nodesToRemove = [];
  villagePictureModel.traverse((child) => {
    if (child === villagePictureModel) {
      return;
    }

    if (!child.isMesh && child.children.length === 0) {
      nodesToRemove.push(child);
    }
  });
  nodesToRemove.forEach((object3d) => object3d.parent?.remove(object3d));

  villagePictureModel.position.set(0, 0, 0);
  villagePictureModel.rotation.set(0, 0, 0);
  villagePictureModel.scale.set(1, 1, 1);
  villagePictureModel.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(villagePictureModel);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const rawCenter = new THREE.Vector3();
  rawBox.getCenter(rawCenter);
  villagePictureModel.position.sub(rawCenter);

  const group = new THREE.Group();
  group.add(villagePictureModel);

  const targetHeight = 1.8;
  const scaleFactor = targetHeight / rawSize.y;
  group.scale.set(scaleFactor, scaleFactor, scaleFactor);

  const minDimension = Math.min(rawSize.x, rawSize.y, rawSize.z);
  const tolerance = minDimension * 0.1 + 0.001;
  if (Math.abs(rawSize.z - minDimension) < tolerance) {
    group.rotation.y = -Math.PI / 2;
  } else if (Math.abs(rawSize.x - minDimension) < tolerance) {
    group.rotation.y = Math.PI;
  } else {
    group.rotation.y = -Math.PI / 2;
    group.rotation.z = Math.PI / 2;
  }

  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(group);

  const wallX = 11.0;
  const wallGap = 0.02;
  const posX = (wallX - wallGap) - scaledBox.max.x;
  const centerY = (scaledBox.min.y + scaledBox.max.y) / 2;
  const posY = 2.2 - centerY;
  const centerZ = (scaledBox.min.z + scaledBox.max.z) / 2;
  const posZ = -18.0 - centerZ;

  group.position.set(posX, posY, posZ);
  scene.add(group);
  villagePictureGroup = group;
  return registerSceneProp('exhibit-village-picture', group);
}

function placeMortarModel(mortarModel) {
  prepareAsset(mortarModel, true);
  autoScaleAndGround(mortarModel, 1.0);
  const currentScale = mortarModel.scale.clone();
  mortarModel.scale.set(currentScale.x * 1.3, currentScale.y * 1.3, currentScale.z * 1.3);
  mortarModel.position.set(5.5, 0, -3.5);
  CharacterGrounding.ground(mortarModel);
  scene.add(mortarModel);
  mortarGroup = mortarModel;
  return registerSceneProp('exhibit-mortar', mortarModel);
}

function placePaperShowingModel(paperShowingModel) {
  prepareAsset(paperShowingModel, false);

  const nodesToRemove = [];
  paperShowingModel.traverse((child) => {
    if (child === paperShowingModel) {
      return;
    }

    if (!child.isMesh && child.children.length === 0) {
      nodesToRemove.push(child);
    }
  });
  nodesToRemove.forEach((object3d) => object3d.parent?.remove(object3d));

  paperShowingModel.position.set(0, 0, 0);
  paperShowingModel.rotation.set(0, 0, 0);
  paperShowingModel.scale.set(1, 1, 1);
  paperShowingModel.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(paperShowingModel);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const rawCenter = new THREE.Vector3();
  rawBox.getCenter(rawCenter);
  paperShowingModel.position.sub(rawCenter);

  const group = new THREE.Group();
  group.add(paperShowingModel);

  const targetHeight = 3.2;
  const scaleFactor = targetHeight / rawSize.y;
  group.scale.set(scaleFactor, scaleFactor, scaleFactor);

  const minDimension = Math.min(rawSize.x, rawSize.y, rawSize.z);
  const tolerance = minDimension * 0.1 + 0.001;
  if (Math.abs(rawSize.z - minDimension) < tolerance) {
    group.rotation.y = -Math.PI / 2;
  } else if (Math.abs(rawSize.x - minDimension) < tolerance) {
    group.rotation.y = Math.PI;
  } else {
    group.rotation.y = -Math.PI / 2;
    group.rotation.z = Math.PI / 2;
  }

  group.position.set(0, 0, 0);
  group.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(group);

  const wallX = 11.0;
  const wallGap = 0.02;
  const posX = (wallX - wallGap) - scaledBox.max.x;
  const centerY = (scaledBox.min.y + scaledBox.max.y) / 2;
  const posY = 2.2 - centerY;
  const centerZ = (scaledBox.min.z + scaledBox.max.z) / 2;
  const posZ = -6.0 - centerZ;

  group.position.set(posX, posY, posZ);
  scene.add(group);
  paperGroup = group;
  return registerSceneProp('exhibit-paper-showing', group);
}

function placeWoodenMouldModel(woodenMouldModel) {
  prepareAsset(woodenMouldModel, true);
  woodenMouldModel.position.set(4.0, 0, 18.0);
  scene.add(woodenMouldModel);
  autoScaleAndGround(woodenMouldModel, 1.2);
  woodenMouldGroup = woodenMouldModel;
  return registerSceneProp('exhibit-wooden-mould', woodenMouldModel);
}

function applyScenePropModel(role, model) {
  switch (role) {
    case 'exhibit-product-showing':
      placeProductShowingModel(model);
      break;
    case 'exhibit-showing-tree':
      placeShowingTreeModel(model);
      break;
    case 'exhibit-village-picture':
      placeVillagePictureModel(model);
      break;
    case 'exhibit-mortar':
      placeMortarModel(model);
      break;
    case 'exhibit-paper-showing':
      placePaperShowingModel(model);
      break;
    case 'exhibit-wooden-mould':
      placeWoodenMouldModel(model);
      break;
    default:
      break;
  }
}

function initializeBaseScene() {
  createMuseumCorridor(scene);
  rebuildStations(bootstrapState.media.stations);
  approvedMediaApplied = bootstrapState.media.status === 'ready';

  const { playerModel, guideModel, guideFSM, mockActions } = createFallbackCharacters();
  tourManager = new TourManager(
    scene,
    camera,
    controls,
    playerModel,
    null,
    mockActions,
    guideModel,
    guideFSM,
    stations,
  );

  createFallbackSceneProps();
}

async function promoteAnimatedCharacters(guidePromotionLoad) {
  if (!modelRegistry) {
    return;
  }

  let playerModel = null;
  let guideModel = null;

  try {
    const loadPromise = guidePromotionLoad ?? Promise.all(GUIDE_PROMOTION_ROLES.map((role) => modelRegistry.loadRole(role)));
    const [model, idleAnim, walkAnim, talkingAnim] = await loadPromise;

    const previousPlayer = tourManager?.player;
    const previousGuide = tourManager?.guide;
    const playerPosition = previousPlayer?.position.clone() ?? new THREE.Vector3(0, 0, -32);
    const guidePosition = previousGuide?.position.clone() ?? new THREE.Vector3(-1.5, 0, -28);
    const playerRotationY = previousPlayer?.rotation.y ?? 0;
    const guideRotationY = previousGuide?.rotation.y ?? 0;

    const scaleFactor = 1.8;
    playerModel = SkeletonUtils.clone(model);
    playerModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    playerModel.position.copy(playerPosition);
    playerModel.rotation.y = playerRotationY;
    CharacterGrounding.ground(playerModel);
    playerModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    playerModel.visible = false;
    scene.add(playerModel);

    const playerMixer = new THREE.AnimationMixer(playerModel);
    const playerActions = {
      idle: playerMixer.clipAction(idleAnim.animations[0]),
      walk: playerMixer.clipAction(walkAnim.animations[0]),
      talk: playerMixer.clipAction(talkingAnim.animations[0]),
    };
    playerModel.userData.actions = playerActions;

    await waitForNextFrame();

    guideModel = SkeletonUtils.clone(model);
    const guideScale = scaleFactor * 1.1;
    guideModel.scale.set(guideScale, guideScale, guideScale);
    guideModel.position.copy(guidePosition);
    guideModel.rotation.y = guideRotationY;
    CharacterGrounding.ground(guideModel, -0.92);
    fixModelMaterials(guideModel, false);
    guideModel.visible = false;
    scene.add(guideModel);

    const guideMixer = new THREE.AnimationMixer(guideModel);
    const guideActions = {
      idle: guideMixer.clipAction(idleAnim.animations[0]),
      walk: guideMixer.clipAction(walkAnim.animations[0]),
      talk: guideMixer.clipAction(talkingAnim.animations[0]),
    };
    const guideFSM = new GuideFSM(guideModel, guideMixer, guideActions);

    await waitForNextFrame();

    const shouldWalk = tourManager?.playerState === PLAYER_STATES.FOLLOWING_GUIDE;
    const nextPlayerAction = shouldWalk ? playerActions.walk : playerActions.idle;
    nextPlayerAction.play();
    currentAction = nextPlayerAction;
    guideFSM.transitionTo(shouldWalk ? GUIDE_STATES.WALKING : GUIDE_STATES.IDLE);

    if (tourManager) {
      tourManager.player = playerModel;
      tourManager.playerMixer = playerMixer;
      tourManager.playerActions = playerActions;
      tourManager.playerCurrentAction = nextPlayerAction;
      tourManager.guide = guideModel;
      tourManager.guideFSM = guideFSM;
    }

    guideModel.visible = true;
    removeSceneObject(previousPlayer);
    removeSceneObject(previousGuide);
    character = playerModel;
    mixers = [playerMixer, guideMixer];
  } catch (error) {
    removeSceneObject(playerModel);
    removeSceneObject(guideModel);
    console.warn('[MediaRuntime] Animated guide assets unavailable, keeping fallback geometry.', error);
  }
}

function maybeLoadSceneProps() {
  // These props are additive context for the room, not a requirement for comprehension.
  // Fallback geometry stays in place until a real asset is safe to promote into the scene.
  if (!character || !modelRegistry) {
    return;
  }

  for (const target of SCENE_PROP_TARGETS) {
    if (loadedScenePropRoles.has(target.role) || scenePropLoadPromises.has(target.role)) {
      continue;
    }

    if (Math.abs(character.position.z - target.activationZ) > SCENE_PROP_ACTIVATION_DISTANCE) {
      continue;
    }

    const loadPromise = modelRegistry.loadRole(target.role)
      .then((model) => {
        applyScenePropModel(target.role, model);
        loadedScenePropRoles.add(target.role);
      })
      .catch((error) => {
        console.warn(`[MediaRuntime] ${target.role} unavailable, keeping fallback geometry.`, error);
      })
      .finally(() => {
        scenePropLoadPromises.delete(target.role);
      });

    scenePropLoadPromises.set(target.role, loadPromise);
  }
}

function applyApprovedMediaIfRunning() {
  if (!runtimeStarted || approvedMediaApplied || bootstrapState.media.status !== 'ready') {
    return;
  }

  rebuildStations(bootstrapState.media.stations);
  approvedMediaApplied = true;
}

function ensureApprovedBootstrap() {
  if (approvedBootstrapPromise) {
    return approvedBootstrapPromise;
  }

  // Scene and tour are the mandatory walkthrough contract. Speculative preload may fail, but
  // the click path must still be able to retry and fall back to the degraded museum shell.
  approvedBootstrapPromise = fetchBootstrapContent({ sceneId: SCENE_ID, tourId: TOUR_ID })
    .then((approvedContent) => {
      bootstrapState = {
        scene: approvedContent.scene,
        tour: approvedContent.tour,
        media: approvedContent.media
          ? adaptMediaManifest(approvedContent.media)
          : createDegradedMediaState({ sceneId: SCENE_ID, error: approvedContent.mediaError }),
      };

      if (bootstrapState.tour?.steps?.length !== 5) {
        console.warn('[MediaRuntime] Approved tour contract changed unexpectedly.', bootstrapState.tour);
      }

      if (approvedContent.mediaError) {
        console.warn('[MediaRuntime] Media manifest unavailable; keeping degraded media UI only.', approvedContent.mediaError);
        approvedBootstrapPromise = null;
        throw approvedContent.mediaError;
      }

      if (bootstrapState.media.status !== 'ready') {
        const error = bootstrapState.media.error ?? new Error('Media manifest is malformed.');
        console.warn('[MediaRuntime] Media manifest malformed; keeping degraded media UI only.', error);
        approvedBootstrapPromise = null;
        throw error;
      }

      modelRegistry = createModelRegistry(bootstrapState.media);
      applyApprovedMediaIfRunning();
      return bootstrapState;
    })
    .catch((error) => {
      approvedBootstrapPromise = null;
      throw error;
    });

  return approvedBootstrapPromise;
}

function ensureGuidePromotionLoad() {
  if (guidePromotionLoad) {
    return guidePromotionLoad;
  }

  guidePromotionLoad = ensureApprovedBootstrap()
    .then(() => {
      if (!modelRegistry) {
        throw new Error('Approved guide assets are unavailable.');
      }

      return Promise.all(GUIDE_PROMOTION_ROLES.map((role) => modelRegistry.loadRole(role)));
    })
    .catch((error) => {
      guidePromotionLoad = null;
      throw error;
    });

  return guidePromotionLoad;
}

export async function preloadMuseumGuides() {
  try {
    await ensureApprovedBootstrap();
    if (!modelRegistry) {
      return false;
    }

    for (const role of LANDING_PRELOAD_GUIDE_ROLES) {
      await modelRegistry.loadRole(role);
      await waitForNextFrame();
    }
    performance.mark('museum:landing-guides-ready');
    return true;
  } catch (error) {
    console.warn('[MediaRuntime] Landing guide preload unavailable; deferring to museum entry.', error);
    return false;
  }
}

async function upgradeApprovedMediaAfterStart() {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureApprovedBootstrap();
      applyApprovedMediaIfRunning();
      if (modelRegistry) {
        void promoteAnimatedCharacters(ensureGuidePromotionLoad());
      }
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('[MediaRuntime] Scene/tour bootstrap unavailable; keeping degraded media shell.', lastError);
}

function fadeToAction(action) {
  if (currentAction === action || !action) {
    return;
  }

  currentAction?.fadeOut?.(0.2);
  action.reset().fadeIn(0.2).play();
  currentAction = action;
}

function updateMovement(delta) {
  if (!character) {
    return;
  }

  const headPos = new THREE.Vector3().copy(character.position).add(new THREE.Vector3(0, 1.3, 0));
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  controls.target.copy(headPos).addScaledVector(direction, 0.05);
  camera.position.copy(headPos);

  // Disable movement if any modal is open
  const isPlaqueOpen = document.getElementById('plaque-modal') && document.getElementById('plaque-modal').classList.contains('visible');
  const isVillageOpen = document.getElementById('village-modal') && document.getElementById('village-modal').classList.contains('visible');
  const isProductOpen = document.getElementById('product-modal') && document.getElementById('product-modal').classList.contains('visible');
  const isMortarOpen = document.getElementById('mortar-modal') && document.getElementById('mortar-modal').classList.contains('visible');
  const isPaperOpen = document.getElementById('paper-modal') && document.getElementById('paper-modal').classList.contains('visible');
  const isMouldOpen = document.getElementById('wooden-mould-modal') && document.getElementById('wooden-mould-modal').classList.contains('visible');
  const isPedestalOpen = document.getElementById('pedestal-modal') && document.getElementById('pedestal-modal').classList.contains('visible');
  const isDryingOpen = document.getElementById('drying-modal') && document.getElementById('drying-modal').classList.contains('visible');
  const isPrintingOpen = document.getElementById('printing-modal') && document.getElementById('printing-modal').classList.contains('visible');
  const isDioramaOpen = document.getElementById('diorama-modal') && document.getElementById('diorama-modal').classList.contains('visible');
  const isGfxWarningOpen = document.getElementById('gfx-warning-modal') && document.getElementById('gfx-warning-modal').classList.contains('visible');
  const isTypingOpen = document.getElementById('typing-modal') && document.getElementById('typing-modal').classList.contains('visible');
  const isVoiceOpen = document.getElementById('voice-modal') && document.getElementById('voice-modal').classList.contains('visible');
  
  if (isPlaqueOpen || isVillageOpen || isProductOpen || isMortarOpen || isPaperOpen || isMouldOpen || isPedestalOpen || isDryingOpen || isPrintingOpen || isDioramaOpen || isGfxWarningOpen || isTypingOpen || isVoiceOpen || (tourManager && tourManager.playerState === PLAYER_STATES.QUESTION_INPUT)) {
    velocity.set(0, 0, 0);
    return;
  }

  // If the Guided Tour is active, the TourManager controls player movement
  if (tourManager && tourManager.playerState !== PLAYER_STATES.FREE) {
    tourManager.update(delta, clock.getElapsedTime());
    return;
  }

  if (tourManager) {
    tourManager.update(delta, clock.getElapsedTime());
  }

  const input = new THREE.Vector3();
  if (keys.w) input.z -= 1;
  if (keys.s) input.z += 1;
  if (keys.a) input.x -= 1;
  if (keys.d) input.x += 1;

  if (input.lengthSq() > 0) {
    input.normalize();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up);
    right.y = 0;
    right.normalize();

    const moveDirection = new THREE.Vector3();
    moveDirection.addScaledVector(forward, -input.z);
    moveDirection.addScaledVector(right, input.x);
    moveDirection.normalize();

    const speedLimit = keys[' '] ? maxSpeed * 2.2 : maxSpeed;
    velocity.x = moveDirection.x * speedLimit;
    velocity.z = moveDirection.z * speedLimit;
  } else {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (speed > 0) {
      const frictionForce = friction * delta;
      const newSpeed = Math.max(0, speed - frictionForce);
      const ratio = newSpeed / speed;
      velocity.x *= ratio;
      velocity.z *= ratio;
    }
  }

  let newX = character.position.x + velocity.x * delta;
  let newZ = character.position.z + velocity.z * delta;
  newX = Math.max(-10.4, Math.min(10.4, newX));
  newZ = Math.max(-34, Math.min(34, newZ));

  // Collision with floor objects (product_showing, showing_tree_01, mortar, wooden mould, cabin, product_showing_2, plaque)
  const colliders = [
    { x: 2.5, z: -9.0, radius: 1.6 },  // product_showing
    { x: 2.5, z: 9.0, radius: 1.5 },   // showing_tree_01
    { x: 5.5, z: -3.5, radius: 1.0 },  // mortar
    { x: 4.0, z: 18.0, radius: 1.2 },  // wooden mould
    { x: 1.5, z: 0.0, radius: 1.2 },   // cabin
    { x: 2.5, z: 24.0, radius: 0.9 },  // product_showing_02
    { x: 8.0, z: -12.0, radius: 0.8 },  // plaque
    { x: 5.0, z: -19.0, radius: 0.7 },  // historical paper pedestal
    { x: 6.0, z: 0.5, radius: 0.8 },    // drying rack (moved from -4.5, 1.5)
    { x: 3.0, z: 14.0, radius: 0.8 },   // printing display
    { x: 0.0, z: 26.0, radius: 1.2 }    // village diorama
  ];

  colliders.forEach((collider) => {
    const dx = newX - collider.x;
    const dz = newZ - collider.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const minDistance = collider.radius + 0.45;
    if (distance >= minDistance) {
      return;
    }

    const pushDistance = minDistance - distance;
    if (distance > 0.001) {
      newX += (dx / distance) * pushDistance;
      newZ += (dz / distance) * pushDistance;
      return;
    }

    newX += minDistance;
  });

  character.position.x = newX;
  character.position.z = newZ;

  if (bootstrapState.media.status === 'ready' && modelRegistry) {
    maybeLoadSceneProps();
  }

  if (character.userData.actions?.walk && character.userData.actions?.idle) {
    const isMoving = Math.abs(velocity.x) > 0.01 || Math.abs(velocity.z) > 0.01;
    fadeToAction(isMoving ? character.userData.actions.walk : character.userData.actions.idle);
  }
}

function bindRuntimeEvents() {
  if (runtimeEventsBound) {
    return;
  }

  runtimeEventsBound = true;
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // Get active modal statuses
    const plaqueModal = document.getElementById('plaque-modal');
    const isPlaqueOpen = plaqueModal && plaqueModal.classList.contains('visible');
    const villageModal = document.getElementById('village-modal');
    const isVillageOpen = villageModal && villageModal.classList.contains('visible');
    const productModal = document.getElementById('product-modal');
    const isProductOpen = productModal && productModal.classList.contains('visible');
    const mortarModal = document.getElementById('mortar-modal');
    const isMortarOpen = mortarModal && mortarModal.classList.contains('visible');
    const paperModal = document.getElementById('paper-modal');
    const isPaperOpen = paperModal && paperModal.classList.contains('visible');
    const woodenMouldModal = document.getElementById('wooden-mould-modal');
    const isMouldOpen = woodenMouldModal && woodenMouldModal.classList.contains('visible');
    const pedestalModal = document.getElementById('pedestal-modal');
    const isPedestalOpen = pedestalModal && pedestalModal.classList.contains('visible');
    const dryingModal = document.getElementById('drying-modal');
    const isDryingOpen = dryingModal && dryingModal.classList.contains('visible');
    const printingModal = document.getElementById('printing-modal');
    const isPrintingOpen = printingModal && printingModal.classList.contains('visible');
    const dioramaModal = document.getElementById('diorama-modal');
    const isDioramaOpen = dioramaModal && dioramaModal.classList.contains('visible');
    const isTypingOpen = document.getElementById('typing-modal') && document.getElementById('typing-modal').classList.contains('visible');
    const isVoiceOpen = document.getElementById('voice-modal') && document.getElementById('voice-modal').classList.contains('visible');
    const isGfxWarningOpen = document.getElementById('gfx-warning-modal') && document.getElementById('gfx-warning-modal').classList.contains('visible');

    function closeModal(modalEl) {
      modalEl.classList.remove('visible');
      if (modalEl.id === 'product-modal') {
        resetProductView();
      }
      if (modalEl.id === 'paper-modal') {
        resetPaperView();
      }
      if (modalEl.id === 'wooden-mould-modal') {
        resetWoodenMouldView();
      }
      if (modalEl.id === 'diorama-modal') {
        resetDioramaView();
      }
      setTimeout(() => {
        if (document.pointerLockElement !== canvas) {
          canvas.requestPointerLock();
        }
      }, 50);
    }

    // If the plaque modal is open, the Q key or Esc/Close should close it. All other inputs are blocked.
    if (isPlaqueOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(plaqueModal);
        e.preventDefault();
      }
      return;
    }

    // If the village modal is open, the Q key should close it. All other inputs are blocked.
    if (isVillageOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(villageModal);
        e.preventDefault();
      }
      return;
    }

    // If the product modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isProductOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(productModal);
        e.preventDefault();
      }
      return;
    }

    // If the mortar modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isMortarOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(mortarModal);
        e.preventDefault();
      }
      return;
    }

    // If the paper modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isPaperOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(paperModal);
        e.preventDefault();
      }
      return;
    }

    // If the wooden mould modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isMouldOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(woodenMouldModal);
        e.preventDefault();
      }
      return;
    }

    // If the pedestal modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isPedestalOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(pedestalModal);
        e.preventDefault();
      }
      return;
    }

    // If the drying modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isDryingOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(dryingModal);
        e.preventDefault();
      }
      return;
    }

    // If the printing modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isPrintingOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(printingModal);
        e.preventDefault();
      }
      return;
    }

    // If the diorama modal is open, Q or Esc should close it. All other inputs are blocked.
    if (isDioramaOpen) {
      if (key === 'q' || key === 'escape') {
        closeModal(dioramaModal);
        e.preventDefault();
      }
      return;
    }

    // If other modals are open, block all keyboard inputs
    if (isTypingOpen || isVoiceOpen || isGfxWarningOpen || (tourManager && tourManager.playerState === PLAYER_STATES.QUESTION_INPUT)) {
      if (isGfxWarningOpen && (key === 'escape')) {
        document.getElementById('gfx-warning-modal')?.classList.remove('visible');
        const gfxBtns = document.querySelectorAll('#gfx-toggle .gfx-btn');
        gfxBtns.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.quality === currentQuality);
        });
        setTimeout(() => {
          if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
          }
        }, 50);
        e.preventDefault();
      }
      return;
    }

    if (key === 'q' && guidePanel !== 'qa-placeholder' && guidePanel !== 'tour-confirmation') {
      // Check plaque proximity
      if (plaque && character) {
        const dist = character.position.distanceTo(plaque.group.position);
        if (dist < 3.0) {
          if (plaqueModal) {
            plaqueModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check village picture proximity (using X-Z distance)
      if (villagePictureGroup && character) {
        const p1 = new THREE.Vector2(character.position.x, character.position.z);
        const p2 = new THREE.Vector2(villagePictureGroup.position.x, villagePictureGroup.position.z);
        const distXZ = p1.distanceTo(p2);
        if (distXZ < 3.0) {
          if (villageModal) {
            villageModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check product exhibit proximity
      if (productGroup && character) {
        const dist = character.position.distanceTo(productGroup.position);
        if (dist < PRODUCT_EXHIBIT.proximityRange) {
          if (productModal) {
            productModal.classList.add('visible');
            buildProductCategories();
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check mortar exhibit proximity
      if (mortarGroup && character) {
        const dist = character.position.distanceTo(mortarGroup.position);
        if (dist < MORTAR_EXHIBIT.proximityRange) {
          if (mortarModal) {
            mortarModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check paper exhibit proximity
      if (paperGroup && character) {
        const dist = character.position.distanceTo(paperGroup.position);
        if (dist < PAPER_EXHIBIT.proximityRange) {
          if (paperModal) {
            paperModal.classList.add('visible');
            buildPaperAdvantages();
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check wooden mould exhibit proximity
      if (woodenMouldGroup && character) {
        const dist = character.position.distanceTo(woodenMouldGroup.position);
        if (dist < WOODEN_MOULD_EXHIBIT.proximityRange) {
          if (woodenMouldModal) {
            woodenMouldModal.classList.add('visible');
            buildWoodenMouldFunctions();
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check pedestal exhibit proximity
      if (pedestalGroup && character) {
        const dist = character.position.distanceTo(pedestalGroup.position);
        if (dist < HISTORICAL_PAPER_EXHIBIT.proximityRange) {
          if (pedestalModal) {
            pedestalModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check drying rack exhibit proximity
      if (dryingGroup && character) {
        const dist = character.position.distanceTo(dryingGroup.position);
        if (dist < DRYING_RACK_EXHIBIT.proximityRange) {
          if (dryingModal) {
            dryingModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check printing display exhibit proximity
      if (printingGroup && character) {
        const dist = character.position.distanceTo(printingGroup.position);
        if (dist < PRINTING_DISPLAY_EXHIBIT.proximityRange) {
          if (printingModal) {
            printingModal.classList.add('visible');
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }

      // Check diorama exhibit proximity
      if (dioramaGroup && character) {
        const dist = character.position.distanceTo(dioramaGroup.position);
        if (dist < VILLAGE_DIORAMA_EXHIBIT.proximityRange) {
          if (dioramaModal) {
            dioramaModal.classList.add('visible');
            buildDioramaSections();
            if (document.pointerLockElement === canvas) {
              document.exitPointerLock();
            }
          }
          e.preventDefault();
          return;
        }
      }
    }

    // Guide panel keyboard handling
    if (guidePanel === 'proximity-menu') {
      if (e.repeat) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) return;
      if (key === '1' || key === 'numpad1') {
        setGuidePanel('qa-placeholder');
        e.preventDefault();
        return;
      }
      if (key === '2' || key === 'numpad2') {
        setGuidePanel('tour-confirmation');
        e.preventDefault();
        return;
      }
    }
    if (guidePanel === 'qa-placeholder' || guidePanel === 'tour-confirmation') {
      if (key === 'escape') {
        setGuidePanel(null);
        e.preventDefault();
        return;
      }
    }

    if (key === 'e') {
      if (tourManager && tourManager.playerState !== PLAYER_STATES.FREE) {
        tourManager.cancelFollow();
        e.preventDefault();
        return;
      }
    }

    if (key === 'f') {
      isTalking = !isTalking;
      console.log('[Input] Toggle Talking:', isTalking);
      e.preventDefault();
    }

    if (key in keys) {
      keys[key] = true;
      e.preventDefault();
    }
  });


  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
      keys[key] = false;
      event.preventDefault();
    }
  });

  addEventListener('resize', () => {
    if (!camera || !renderer) {
      return;
    }

    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

// Product exhibit modal data and UI
const productData = PRODUCT_EXHIBIT;

function buildProductCategories() {
  const grid = document.querySelector('#product-modal .products-grid');
  if (!grid || grid.children.length > 0) return;
  productData.categories.forEach((cat, i) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.textContent = cat.title;
    card.addEventListener('click', () => showProductDetail(i));
    grid.appendChild(card);
  });
}

function showProductDetail(index) {
  const cat = productData.categories[index];
  document.getElementById('product-top-view').style.display = 'none';
  document.getElementById('product-detail-view').style.display = '';
  document.getElementById('product-detail-title').textContent = cat.title;
  document.getElementById('product-detail-body').textContent = cat.content;
  document.getElementById('product-back').style.display = 'inline-block';
}

function resetProductView() {
  document.getElementById('product-detail-view').style.display = 'none';
  document.getElementById('product-top-view').style.display = '';
  document.getElementById('product-back').style.display = 'none';
}

// Product modal button bindings
const productModal = document.getElementById('product-modal');
document.getElementById('product-close')?.addEventListener('click', () => {
  if (productModal) {
    productModal.classList.remove('visible');
    resetProductView();
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});
document.getElementById('product-back')?.addEventListener('click', () => {
  resetProductView();
});

// Mortar modal button binding
const mortarModal = document.getElementById('mortar-modal');
document.getElementById('mortar-close')?.addEventListener('click', () => {
  if (mortarModal) {
    mortarModal.classList.remove('visible');
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});

// Paper exhibit modal data and UI
const paperData = PAPER_EXHIBIT;

function buildPaperAdvantages() {
  const grid = document.querySelector('#paper-modal .advantages-grid');
  if (!grid || grid.children.length > 0) return;
  paperData.advantages.forEach((adv, i) => {
    const card = document.createElement('div');
    card.className = 'advantage-card';
    card.textContent = adv.title;
    card.addEventListener('click', () => showPaperDetail(i));
    grid.appendChild(card);
  });
}

function showPaperDetail(index) {
  const adv = paperData.advantages[index];
  document.getElementById('paper-main-view').style.display = 'none';
  document.getElementById('paper-detail-view').style.display = '';
  document.getElementById('paper-detail-title').textContent = adv.title;
  document.getElementById('paper-detail-body').textContent = adv.content;
  document.getElementById('paper-back').style.display = 'inline-block';
  document.querySelectorAll('#paper-modal .advantage-card').forEach((c, i) => {
    c.classList.toggle('selected', i === index);
  });
}

function resetPaperView() {
  document.getElementById('paper-detail-view').style.display = 'none';
  document.getElementById('paper-main-view').style.display = '';
  document.getElementById('paper-back').style.display = 'none';
  document.querySelectorAll('#paper-modal .advantage-card').forEach(c => {
    c.classList.remove('selected');
  });
}

// Paper modal button bindings
const paperModal = document.getElementById('paper-modal');
document.getElementById('paper-close')?.addEventListener('click', () => {
  if (paperModal) {
    paperModal.classList.remove('visible');
    resetPaperView();
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});
document.getElementById('paper-back')?.addEventListener('click', () => {
  resetPaperView();
});

// Wooden mould exhibit modal data and UI
const mouldData = WOODEN_MOULD_EXHIBIT;

function buildWoodenMouldFunctions() {
  const grid = document.querySelector('#wooden-mould-modal .mould-functions-grid');
  if (!grid || grid.children.length > 0) return;
  mouldData.functions.forEach((fn, i) => {
    const card = document.createElement('div');
    card.className = 'mould-function-card';
    card.textContent = fn.title;
    card.addEventListener('click', () => showMouldFunctionDetail(i));
    grid.appendChild(card);
  });
}

function showMouldFunctionDetail(index) {
  const fn = mouldData.functions[index];
  document.getElementById('wooden-mould-main-view').style.display = 'none';
  document.getElementById('wooden-mould-detail-view').style.display = '';
  document.getElementById('wooden-mould-detail-title').textContent = fn.title;
  document.getElementById('wooden-mould-detail-body').textContent = fn.content;
  document.getElementById('wooden-mould-back').style.display = 'inline-block';
  document.querySelectorAll('#wooden-mould-modal .mould-function-card').forEach((c, i) => {
    c.classList.toggle('selected', i === index);
  });
}

function resetWoodenMouldView() {
  document.getElementById('wooden-mould-detail-view').style.display = 'none';
  document.getElementById('wooden-mould-main-view').style.display = '';
  document.getElementById('wooden-mould-back').style.display = 'none';
  document.querySelectorAll('#wooden-mould-modal .mould-function-card').forEach(c => {
    c.classList.remove('selected');
  });
}

// Wooden mould modal button bindings
const woodenMouldModal = document.getElementById('wooden-mould-modal');
document.getElementById('wooden-mould-close')?.addEventListener('click', () => {
  if (woodenMouldModal) {
    woodenMouldModal.classList.remove('visible');
    resetWoodenMouldView();
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});
document.getElementById('wooden-mould-back')?.addEventListener('click', () => {
  resetWoodenMouldView();
});

// New exhibit modal button bindings
const pedestalModal = document.getElementById('pedestal-modal');
document.getElementById('pedestal-close')?.addEventListener('click', () => {
  if (pedestalModal) {
    pedestalModal.classList.remove('visible');
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});

const dryingModal = document.getElementById('drying-modal');
document.getElementById('drying-close')?.addEventListener('click', () => {
  if (dryingModal) {
    dryingModal.classList.remove('visible');
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});

const printingModal = document.getElementById('printing-modal');
document.getElementById('printing-close')?.addEventListener('click', () => {
  if (printingModal) {
    printingModal.classList.remove('visible');
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});

// Diorama exhibit modal data and UI
const dioramaData = VILLAGE_DIORAMA_EXHIBIT;

function buildDioramaSections() {
  const grid = document.querySelector('#diorama-modal .diorama-sections-grid');
  if (!grid) return;
  grid.querySelectorAll('.diorama-section-btn').forEach(btn => {
    btn.removeEventListener('click', handleDioramaSectionClick);
    btn.addEventListener('click', handleDioramaSectionClick);
  });
}

function handleDioramaSectionClick(e) {
  const idx = parseInt(e.currentTarget.getAttribute('data-section'), 10);
  showDioramaDetail(idx);
}

function showDioramaDetail(index) {
  const section = dioramaData.sections[index];
  if (!section) return;
  document.getElementById('diorama-main-view').style.display = 'none';
  document.getElementById('diorama-detail-view').style.display = '';
  document.getElementById('diorama-detail-title').textContent = section.id + ' – ' + section.title;
  document.getElementById('diorama-detail-body').textContent = section.content;
  document.getElementById('diorama-back').style.display = 'inline-block';
}

function resetDioramaView() {
  document.getElementById('diorama-detail-view').style.display = 'none';
  document.getElementById('diorama-main-view').style.display = '';
  document.getElementById('diorama-back').style.display = 'none';
}

const dioramaModal = document.getElementById('diorama-modal');
document.getElementById('diorama-close')?.addEventListener('click', () => {
  if (dioramaModal) {
    dioramaModal.classList.remove('visible');
    resetDioramaView();
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  }
});
document.getElementById('diorama-back')?.addEventListener('click', () => {
  resetDioramaView();
});

// Graphics quality management
let currentQuality = 'medium';

function setGraphicsQuality(level) {
  currentQuality = level;

  const gfxBtns = document.querySelectorAll('#gfx-toggle .gfx-btn');
  gfxBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quality === level);
  });

  switch (level) {
    case 'low':
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.5));
      renderer.shadowMap.enabled = false;
      sunLight.castShadow = false;
      renderer.toneMappingExposure = 1.4;
      break;

    case 'medium':
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sunLight.castShadow = true;
      renderer.toneMappingExposure = 1.75;
      break;

    case 'high':
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sunLight.castShadow = true;
      renderer.toneMappingExposure = 2.0;
      break;
  }
  renderer.shadowMap.needsUpdate = true;
}

// Graphics toggle button bindings
document.querySelectorAll('#gfx-toggle .gfx-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const quality = btn.dataset.quality;
    if (quality === currentQuality) return;

    if (quality === 'high') {
      const warningModal = document.getElementById('gfx-warning-modal');
      if (warningModal) {
        warningModal.classList.add('visible');
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
        return;
      }
    }

    setGraphicsQuality(quality);
  });
});

document.getElementById('gfx-warning-confirm')?.addEventListener('click', () => {
  document.getElementById('gfx-warning-modal')?.classList.remove('visible');
  setGraphicsQuality('high');
  setTimeout(() => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }, 50);
});

document.getElementById('gfx-warning-cancel')?.addEventListener('click', () => {
  document.getElementById('gfx-warning-modal')?.classList.remove('visible');
  // Stay on current level
  // Re-highlight the active button
  const gfxBtns = document.querySelectorAll('#gfx-toggle .gfx-btn');
  gfxBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quality === currentQuality);
  });
  setTimeout(() => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  }, 50);
});

// Guide panel state management
function setGuidePanel(panel) {
  const proximityMenu = document.getElementById('guide-proximity-menu');
  const qaPanel = document.getElementById('guide-qa-panel');
  const tourPanel = document.getElementById('guide-tour-panel');

  [proximityMenu, qaPanel, tourPanel].forEach(el => {
    if (el) el.classList.remove('visible');
  });

  guidePanel = panel;

  if (panel === 'proximity-menu') {
    if (proximityMenu) proximityMenu.classList.add('visible');
  } else if (panel === 'qa-placeholder') {
    if (qaPanel) qaPanel.classList.add('visible');
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  } else if (panel === 'tour-confirmation') {
    if (tourPanel) tourPanel.classList.add('visible');
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
}

// Guide panel button bindings
document.querySelectorAll('.guide-menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const opt = btn.getAttribute('data-option');
    if (opt === '1') setGuidePanel('qa-placeholder');
    else if (opt === '2') setGuidePanel('tour-confirmation');
  });
});
document.getElementById('guide-qa-back')?.addEventListener('click', () => {
  setGuidePanel('proximity-menu');
});
document.getElementById('guide-qa-close')?.addEventListener('click', () => {
  setGuidePanel(null);
});
document.getElementById('guide-tour-cancel')?.addEventListener('click', () => {
  setGuidePanel('proximity-menu');
});
document.getElementById('guide-tour-start')?.addEventListener('click', () => {
  if (tourManager && tourManager.playerState === PLAYER_STATES.FREE) {
    setGuidePanel(null);
    tourManager.startTour();
  }
});


let didSignalFirstFrame = false;

function animate() {
  if (!runtimeStarted || !clock || !scene || !camera || !renderer || !controls) {
    return;
  }

  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  checkUIAndUnlock();

  updateMovement(delta);
  updateCeilingFans(delta);

  const time = clock.getElapsedTime();
  if (videoActivationSystem && character) {
    videoActivationSystem.update(time, character.position, tourManager ? tourManager.guide.position : null);
  }

  // Update plaque prompt visibility based on player distance
  if (plaque && character) {
    const dist = character.position.distanceTo(plaque.group.position);
    const plaquePrompt = document.getElementById('plaque-prompt');
    const plaqueModal = document.getElementById('plaque-modal');
    if (plaquePrompt && plaqueModal) {
      const isModalOpen = plaqueModal.classList.contains('visible');
      if (dist < 3.0 && !isModalOpen) {
        plaquePrompt.classList.add('visible');
      } else {
        plaquePrompt.classList.remove('visible');
      }
    }
  }

  // Update village picture prompt visibility based on player distance
  if (villagePictureGroup && character) {
    const p1 = new THREE.Vector2(character.position.x, character.position.z);
    const p2 = new THREE.Vector2(villagePictureGroup.position.x, villagePictureGroup.position.z);
    const distXZ = p1.distanceTo(p2);
    const villagePrompt = document.getElementById('village-prompt');
    const villageModal = document.getElementById('village-modal');
    if (villagePrompt && villageModal) {
      const isModalOpen = villageModal.classList.contains('visible');
      if (distXZ < 3.0 && !isModalOpen) {
        villagePrompt.classList.add('visible');
      } else {
        villagePrompt.classList.remove('visible');
      }
    }
  }

  // Update product exhibit prompt visibility based on player distance
  if (productGroup && character) {
    const dist = character.position.distanceTo(productGroup.position);
    const productPrompt = document.getElementById('product-prompt');
    const productModal = document.getElementById('product-modal');
    if (productPrompt && productModal) {
      const isModalOpen = productModal.classList.contains('visible');
      if (dist < PRODUCT_EXHIBIT.proximityRange && !isModalOpen) {
        productPrompt.classList.add('visible');
      } else {
        productPrompt.classList.remove('visible');
      }
    }
  }

  // Update mortar exhibit prompt visibility based on player distance
  if (mortarGroup && character) {
    const dist = character.position.distanceTo(mortarGroup.position);
    const mortarPrompt = document.getElementById('mortar-prompt');
    const mortarModal = document.getElementById('mortar-modal');
    if (mortarPrompt && mortarModal) {
      const isModalOpen = mortarModal.classList.contains('visible');
      if (dist < MORTAR_EXHIBIT.proximityRange && !isModalOpen) {
        mortarPrompt.classList.add('visible');
      } else {
        mortarPrompt.classList.remove('visible');
      }
    }
  }

  // Update paper exhibit prompt visibility based on player distance
  if (paperGroup && character) {
    const dist = character.position.distanceTo(paperGroup.position);
    const paperPrompt = document.getElementById('paper-prompt');
    const paperModal = document.getElementById('paper-modal');
    if (paperPrompt && paperModal) {
      const isModalOpen = paperModal.classList.contains('visible');
      if (dist < PAPER_EXHIBIT.proximityRange && !isModalOpen) {
        paperPrompt.classList.add('visible');
      } else {
        paperPrompt.classList.remove('visible');
      }
    }
  }

  // Update wooden mould exhibit prompt visibility based on player distance
  if (woodenMouldGroup && character) {
    const dist = character.position.distanceTo(woodenMouldGroup.position);
    const mouldPrompt = document.getElementById('wooden-mould-prompt');
    const mouldModal = document.getElementById('wooden-mould-modal');
    if (mouldPrompt && mouldModal) {
      const isModalOpen = mouldModal.classList.contains('visible');
      if (dist < WOODEN_MOULD_EXHIBIT.proximityRange && !isModalOpen) {
        mouldPrompt.classList.add('visible');
      } else {
        mouldPrompt.classList.remove('visible');
      }
    }
  }

  // Update pedestal exhibit prompt visibility
  if (pedestalGroup && character) {
    const dist = character.position.distanceTo(pedestalGroup.position);
    const pedestalPrompt = document.getElementById('pedestal-prompt');
    const pedestalModal = document.getElementById('pedestal-modal');
    if (pedestalPrompt && pedestalModal) {
      const isModalOpen = pedestalModal.classList.contains('visible');
      if (dist < HISTORICAL_PAPER_EXHIBIT.proximityRange && !isModalOpen) {
        pedestalPrompt.classList.add('visible');
      } else {
        pedestalPrompt.classList.remove('visible');
      }
    }
  }

  // Update drying rack exhibit prompt visibility
  if (dryingGroup && character) {
    const dist = character.position.distanceTo(dryingGroup.position);
    const dryingPrompt = document.getElementById('drying-prompt');
    const dryingModal = document.getElementById('drying-modal');
    if (dryingPrompt && dryingModal) {
      const isModalOpen = dryingModal.classList.contains('visible');
      if (dist < DRYING_RACK_EXHIBIT.proximityRange && !isModalOpen) {
        dryingPrompt.classList.add('visible');
      } else {
        dryingPrompt.classList.remove('visible');
      }
    }
  }

  // Update printing display exhibit prompt visibility
  if (printingGroup && character) {
    const dist = character.position.distanceTo(printingGroup.position);
    const printingPrompt = document.getElementById('printing-prompt');
    const printingModal = document.getElementById('printing-modal');
    if (printingPrompt && printingModal) {
      const isModalOpen = printingModal.classList.contains('visible');
      if (dist < PRINTING_DISPLAY_EXHIBIT.proximityRange && !isModalOpen) {
        printingPrompt.classList.add('visible');
      } else {
        printingPrompt.classList.remove('visible');
      }
    }
  }

  // Update diorama exhibit prompt visibility
  if (dioramaGroup && character) {
    const dist = character.position.distanceTo(dioramaGroup.position);
    const dioramaPrompt = document.getElementById('diorama-prompt');
    const dioramaModal = document.getElementById('diorama-modal');
    if (dioramaPrompt && dioramaModal) {
      const isModalOpen = dioramaModal.classList.contains('visible');
      if (dist < VILLAGE_DIORAMA_EXHIBIT.proximityRange && !isModalOpen) {
        dioramaPrompt.classList.add('visible');
      } else {
        dioramaPrompt.classList.remove('visible');
      }
    }
  }

  // Guide proximity: show/hide the two-option panel based on distance to guide
  if (character && tourManager && tourManager.guide) {
    const dist = character.position.distanceTo(tourManager.guide.position);
    const inRange = dist < GUIDE_PROXIMITY_RANGE;
    const tourActive = tourManager.playerState !== PLAYER_STATES.FREE;
    const anyExhibitOpen =
      (document.getElementById('plaque-modal') && document.getElementById('plaque-modal').classList.contains('visible')) ||
      (document.getElementById('village-modal') && document.getElementById('village-modal').classList.contains('visible')) ||
      (document.getElementById('product-modal') && document.getElementById('product-modal').classList.contains('visible')) ||
      (document.getElementById('mortar-modal') && document.getElementById('mortar-modal').classList.contains('visible')) ||
      (document.getElementById('paper-modal') && document.getElementById('paper-modal').classList.contains('visible')) ||
    (document.getElementById('wooden-mould-modal') && document.getElementById('wooden-mould-modal').classList.contains('visible')) ||
    (document.getElementById('pedestal-modal') && document.getElementById('pedestal-modal').classList.contains('visible')) ||
    (document.getElementById('drying-modal') && document.getElementById('drying-modal').classList.contains('visible')) ||
    (document.getElementById('printing-modal') && document.getElementById('printing-modal').classList.contains('visible')) ||
    (document.getElementById('diorama-modal') && document.getElementById('diorama-modal').classList.contains('visible'));

    if (inRange && !tourActive && !anyExhibitOpen && guidePanel === null) {
      setGuidePanel('proximity-menu');
    } else if (!inRange && guidePanel === 'proximity-menu') {
      setGuidePanel(null);
    }
  }

  // Update secondary mixer (Guide NPC) during free explore, optimized by distance culling
  if (tourManager && mixers[1]) {
    const shouldUpdateGuide = tourManager.playerState !== PLAYER_STATES.FREE ||
      (character && character.position.distanceTo(tourManager.guide.position) < 15);
    if (shouldUpdateGuide) {
      mixers[1].update(delta);
    }
  }

  if (tourManager?.guide) {
    uiController.updateGuideAskBubble(camera, tourManager.guide);
  }

  controls.update();
  renderer.render(scene, camera);

  if (!didSignalFirstFrame) {
    didSignalFirstFrame = true;
    performance.mark('museum:first-frame');
    window.dispatchEvent(new Event('museum:first-frame'));
  }
}

let sharedAudioCtx = null;

function getSharedAudioContext() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Transcodes a containerized browser audio blob (WebM/MP4 Opus) into a raw 16kHz mono Int16 PCM byte array.
 * Reuses the shared AudioContext and invokes OfflineAudioContext for zero-dependency client-side resampling.
 *
 * @param {Blob} blob - The recorded browser audio blob containing the user's speech query.
 * @returns {Promise<ArrayBuffer>} Promise resolving to the raw Int16 PCM data buffer.
 */
async function convertBlobToPcm(blob) {
  const arrayBuffer = await blob.arrayBuffer();

  const audioCtx = getSharedAudioContext();
  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.error("decodeAudioData failed:", err);
    throw err;
  }

  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start();

  const renderedBuffer = await offlineCtx.startRendering();
  const floatSamples = renderedBuffer.getChannelData(0);

  const buffer = new ArrayBuffer(floatSamples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < floatSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    const intVal = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, intVal, true); // little-endian
  }

  return {
    mimeType: 'audio/pcm;rate=16000',
    dataBase64: arrayBufferToBase64(buffer)
  };
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

uiController.setQuestionHandlers({
  submitText(question) {
    return submitGuideTurn({ question });
  },
  async submitAudio({ blob, mimeType, durationMs }) {
    try {
      const pcmData = await convertBlobToPcm(blob);
      await submitGuideTurn({
        audio: {
          mimeType: pcmData.mimeType,
          dataBase64: pcmData.dataBase64,
          durationMs,
        },
      });
    } catch (error) {
      console.error("PCM conversion failed, falling back to original blob upload:", error);
      await submitGuideTurn({
        audio: {
          mimeType,
          dataBase64: await blobToBase64(blob),
          durationMs,
        },
      });
    }
  },
  resetVoiceState() {
    tourManager?.resetQuestionState?.();
  },
});

export function startMuseumApp() {
  if (runtimeStartPromise) {
    return runtimeStartPromise;
  }

  runtimeStartPromise = Promise.resolve()
    .then(() => {
      performance.mark('museum:start');
      ensureRuntimeShell();
      performance.mark('museum:shell-ready');
      bindRuntimeEvents();
      initializeBaseScene();
      performance.mark('museum:base-scene-ready');
      runtimeStarted = true;

      if (!animationStarted) {
        animationStarted = true;
        animate();
      }

      void readLiveCapability().then((capability) => {
        liveCapability = capability;
      });

      void upgradeApprovedMediaAfterStart();
    })
    .catch((error) => {
      resetRuntimeShell();
      runtimeStartPromise = null;
      throw error;
    });

  return runtimeStartPromise;
}
