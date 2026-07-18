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
import { fetchBootstrapContent } from './media/client.js';
import { adaptMediaManifest, createDegradedMediaState } from './media/manifest-adapter.js';
import { createModelRegistry } from './media/model-registry.js';
import { readLiveCapability, submitQuestionTurn } from './qa/live-client.js';

const SCENE_ID = 'tay-ho-giay-do-room-01';
const TOUR_ID = 'tour-01';
const SCENE_PROP_ACTIVATION_DISTANCE = 16;
const SCENE_PROP_TARGETS = [
  { role: 'exhibit-village-picture', activationZ: -18 },
  { role: 'exhibit-product-showing', activationZ: -9 },
  { role: 'exhibit-paper-showing', activationZ: -6 },
  { role: 'exhibit-mortar', activationZ: 0 },
  { role: 'exhibit-showing-tree', activationZ: 9 },
  { role: 'exhibit-wooden-mould', activationZ: 18 },
];
const GUIDE_PROMOTION_ROLES = ['guide-model', 'guide-idle', 'guide-walk', 'guide-talk'];

const scene = new THREE.Scene();
let videoActivationSystem = null;
let character = null;
let currentAction = null;
let isTalking = false;
let mixers = [];
let tourManager = null;
let stations = [];
let modelRegistry = null;
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

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3, -35);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.75;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.3, -32);
controls.enableDamping = false;
controls.rotateSpeed = 0.45;
controls.minDistance = 0.01;
controls.maxDistance = 0.1;
controls.enableZoom = false;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 1.9;
controls.minPolarAngle = Math.PI / 3.0;
controls.update();

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
scene.add(sunLight);

const keys = { w: false, a: false, s: false, d: false, ' ': false };
const velocity = new THREE.Vector3();
const maxSpeed = 2.4;
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
  registerSceneProp('exhibit-village-picture', pictureFallback);

  const mortarFallback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d8072, roughness: 0.85 }),
  );
  mortarFallback.position.set(5.0, 0, 0);
  scene.add(mortarFallback);
  CharacterGrounding.ground(mortarFallback);
  registerSceneProp('exhibit-mortar', mortarFallback);

  const paperFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.2, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd4c9a8, roughness: 0.5 }),
  );
  paperFallback.position.set(10.95, 2.2, -6.0);
  scene.add(paperFallback);
  registerSceneProp('exhibit-paper-showing', paperFallback);

  const mouldFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 }),
  );
  mouldFallback.position.set(4.0, 0.6, 18.0);
  scene.add(mouldFallback);
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
  return registerSceneProp('exhibit-village-picture', group);
}

function placeMortarModel(mortarModel) {
  prepareAsset(mortarModel, true);
  autoScaleAndGround(mortarModel, 1.0);
  const currentScale = mortarModel.scale.clone();
  mortarModel.scale.set(currentScale.x * 1.3, currentScale.y * 1.3, currentScale.z * 1.3);
  mortarModel.position.set(5.0, 0, 0);
  CharacterGrounding.ground(mortarModel);
  scene.add(mortarModel);
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
  return registerSceneProp('exhibit-paper-showing', group);
}

function placeWoodenMouldModel(woodenMouldModel) {
  prepareAsset(woodenMouldModel, true);
  woodenMouldModel.position.set(4.0, 0, 18.0);
  scene.add(woodenMouldModel);
  autoScaleAndGround(woodenMouldModel, 1.2);
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
  removeLoadingScreen();
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

async function bootstrapApprovedMedia() {
  // Scene and tour are the mandatory walkthrough contract. Media is intentionally layered on
  // afterwards so a culturally meaningful path still exists when heavier assets or services fail.
  let approvedContent;

  try {
    approvedContent = await fetchBootstrapContent({ sceneId: SCENE_ID, tourId: TOUR_ID });
  } catch (error) {
    console.warn('[MediaRuntime] Scene/tour bootstrap unavailable; keeping degraded media shell.', error);
    return;
  }

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
    return;
  }

  if (bootstrapState.media.status !== 'ready') {
    console.warn('[MediaRuntime] Media manifest malformed; keeping degraded media UI only.', bootstrapState.media.error);
    return;
  }

  rebuildStations(bootstrapState.media.stations);
  modelRegistry = createModelRegistry(bootstrapState.media);
  const guidePromotionLoad = Promise.all(GUIDE_PROMOTION_ROLES.map((role) => modelRegistry.loadRole(role)));
  void promoteAnimatedCharacters(guidePromotionLoad);
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

  const colliders = [
    { x: 2.5, z: -9.0, radius: 1.6 },
    { x: 2.5, z: 9.0, radius: 1.5 },
    { x: 5.0, z: 0, radius: 1.0 },
    { x: 4.0, z: 18.0, radius: 1.2 },
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

document.addEventListener('keydown', (event) => {
  if (tourManager && tourManager.playerState === PLAYER_STATES.QUESTION_INPUT) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'e' && tourManager && tourManager.playerState !== PLAYER_STATES.FREE) {
    tourManager.cancelFollow();
    event.preventDefault();
    return;
  }

  if (key === 'f') {
    isTalking = !isTalking;
    console.log('[Input] Toggle Talking:', isTalking);
    event.preventDefault();
  }

  if (key in keys) {
    keys[key] = true;
    event.preventDefault();
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
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updateMovement(delta);
  updateCeilingFans(delta);

  const time = clock.getElapsedTime();
  if (videoActivationSystem && character) {
    videoActivationSystem.update(time, character.position, tourManager ? tourManager.guide.position : null);
  }

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

void readLiveCapability().then((capability) => {
  liveCapability = capability;
});

initializeBaseScene();
void bootstrapApprovedMedia();
animate();
