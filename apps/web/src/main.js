import { createSceneAppHtml } from './scene/app.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import { createMuseumCorridor, updateCeilingFans } from './components/MuseumCorridor.js';
import { createExhibitionWall } from './components/ExhibitionWall/ExhibitionWall.js';
import { GuideFSM } from './systems/GuideFSM.js';
import { TourManager, PLAYER_STATES } from './systems/TourManager.js';
import { uiController } from './systems/UIController.js';
import { CharacterGrounding } from './systems/CharacterGrounding.js';
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

const scene = new THREE.Scene();
let videoActivationSystem;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3, -35); // Start closer to the entrance walkway
camera.rotation.order = 'YXZ'; // Set rotation order for FPS look controls
scene.add(camera); // Ensure camera children (arms) are rendered

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
controls.rotateSpeed = 0.45; // Reduced mouse looking sensitivity
controls.minDistance = 0.01;
controls.maxDistance = 0.1;
controls.enableZoom = false;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 1.9;
controls.minPolarAngle = Math.PI / 3.0; // restrict vertical looking
controls.update();

// Pointer Lock Controls Integration
const canvas = renderer.domElement;
let isPointerLocked = false;
let videosBlessed = false;

function blessVideos() {
  if (stations && stations.length > 0) {
    stations.forEach(station => {
      const video = station.videoDisplay.video;
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

canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
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
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  });
}

const optContinue = document.getElementById('opt-continue');
if (optContinue) {
  optContinue.addEventListener('click', () => {
    setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    }, 50);
  });
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    isPointerLocked = true;
    controls.enabled = false;
  } else {
    isPointerLocked = false;
    controls.enabled = true;
    // Sync OrbitControls target when exiting pointer lock
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const headPos = new THREE.Vector3().copy(character ? character.position : camera.position).add(new THREE.Vector3(0, 1.3, 0));
    controls.target.copy(headPos).addScaledVector(dir, 0.05);
    controls.update();
  }
});

const lookSensitivity = 0.002;
document.addEventListener('mousemove', (e) => {
  if (!isPointerLocked) return;

  camera.rotation.y -= e.movementX * lookSensitivity;
  camera.rotation.x -= e.movementY * lookSensitivity;

  // Clamp vertical look to -80 / +80 degrees to prevent flipping upside down
  const maxPitch = Math.PI / 2.25;
  camera.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x));
});

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
  
  if (isUIOpen && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

// Sun Light (Warm golden sunlight filtering from gaps)
const sunLight = new THREE.DirectionalLight(0xffe2ab, 1.5);
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

const loader = new FBXLoader();
const modelPath = '/guide_girl/huongdanvien.fbx';
const idlePath = '/guide_girl/Idle.fbx';
const walkPath = '/guide_girl/Walking.fbx';
const talkingPath = '/guide_girl/Talking.fbx';
const productShowingPath = '/asset/product_showing.fbx';
const showingTreePath = '/asset/showing_tree_01.fbx';
const villagePicturePath = '/asset/village_picture.fbx';
const mortarPath = '/asset/mortar.fbx';
const paperShowingPath = '/asset/paper_showing.fbx';
const woodenMouldPath = '/asset/woodenmould.fbx';
const cabinPath = '/asset/cabin.fbx';
const productShowing02Path = '/asset/product_showing_02.fbx';

let character; // The user's controllable player character
let currentAction;
let mixers = [];
let tourManager = null;
let stations = [];
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
const rotationSpeed = 10;

console.log('[FBXLoader] Bắt đầu tải model...', { modelPath, idlePath, walkPath, talkingPath });

const loadWithLog = (path, label) => {
  console.log(`[FBXLoader] Đang tải: ${label} (${path})`);
  return loader.loadAsync(path).then(result => {
    console.log(`[FBXLoader] ✅ Tải thành công: ${label}`);
    return result;
  });
};

function autoScaleAndGround(model, targetHeight) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) {
    const scale = targetHeight / size.y;
    model.scale.set(scale, scale, scale);
    console.log(`[AutoScale] Scaling model to ${scale.toFixed(4)} (target height: ${targetHeight}m, original height: ${size.y.toFixed(2)}m)`);
  }
  CharacterGrounding.ground(model);
}

function fixModelMaterials(model, receiveShadow = true) {
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = receiveShadow;
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => adjustSingleMaterial(mat));
        } else {
          child.material = adjustSingleMaterial(child.material);
        }
      }
    }
  });
}

function adjustSingleMaterial(mat) {
  if (mat.isMeshBasicMaterial) {
    const stdMat = new THREE.MeshStandardMaterial({
      map: mat.map,
      color: mat.color ? mat.color.clone().multiplyScalar(1.0) : new THREE.Color(0xcccccc),
      roughness: 0.85,
      metalness: 0.05
    });
    return stdMat;
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

function prepareAsset(model, receiveShadow = true) {
  // Remove any light or camera objects exported in the FBX to prevent changing global scene colors
  const lightsToRemove = [];
  model.traverse(child => {
    if (child.isLight || child.isCamera) {
      lightsToRemove.push(child);
    }
  });
  lightsToRemove.forEach(light => {
    if (light.parent) {
      light.parent.remove(light);
    }
  });

  // Clone materials to prevent bleed-through/override of shared properties
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = receiveShadow;
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => mat.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    }
  });
}

Promise.all([
  loadWithLog(modelPath, 'Main model'),
  loadWithLog(idlePath, 'Idle animation'),
  loadWithLog(walkPath, 'Walk animation'),
  loadWithLog(talkingPath, 'Talking animation'),
  loadWithLog(productShowingPath, 'Product showing'),
  loadWithLog(showingTreePath, 'Showing tree 01'),
  loadWithLog(villagePicturePath, 'Village picture'),
  loadWithLog(mortarPath, 'Mortar'),
  loadWithLog(paperShowingPath, 'Paper showing'),
  loadWithLog(woodenMouldPath, 'Wooden mould'),
  loadWithLog(cabinPath, 'Cabin'),
  loadWithLog(productShowing02Path, 'Product showing 02'),
]).then(([model, idleAnim, walkAnim, talkingAnim, productShowingModel, showingTreeModel, villagePictureModel, mortarModel, paperShowingModel, woodenMouldModel, cabinModel, productShowing02Model]) => {
  console.log('[FBXLoader] ✅ Tất cả file đã tải xong, đang khởi tạo nhân vật...');

  // Setup Museum architecture & exhibition screens
  createMuseumCorridor(scene);
  stations = createExhibitionWall(scene);
  
  // Pre-load all video displays at startup
  stations.forEach(station => {
    station.videoDisplay.load();
  });

  videoActivationSystem = new VideoActivationSystem(stations);

  // Remove loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 500);
  }

  const scaleFactor = 1.8;

  // 1. Initialize Player character
  const playerModel = SkeletonUtils.clone(model);
  playerModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
  playerModel.position.set(0, 0, -32); // start near the entrance

  CharacterGrounding.ground(playerModel);

  playerModel.traverse(child => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  playerModel.visible = false; // Hide player character for first-person view
  scene.add(playerModel);
  character = playerModel; // Assign to global character variable

  const playerMixer = new THREE.AnimationMixer(playerModel);
  const playerActions = {
    idle: playerMixer.clipAction(idleAnim.animations[0]),
    walk: playerMixer.clipAction(walkAnim.animations[0]),
    talk: playerMixer.clipAction(talkingAnim.animations[0])
  };
  
  // Store actions in userData for updateMovement reference
  playerModel.userData.actions = playerActions;
  playerActions.idle.play();
  currentAction = playerActions.idle;

  // 2. Initialize Guide NPC
  const guideModel = SkeletonUtils.clone(model);
  const guideScale = scaleFactor * 1.1; // scale up guide slightly
  guideModel.scale.set(guideScale, guideScale, guideScale);
  guideModel.position.set(-1.5, 0, -28); // stand left of walkway near start

  CharacterGrounding.ground(guideModel, -0.92);

  fixModelMaterials(guideModel, false);
  scene.add(guideModel);

  // 3. Initialize new assets: product_showing and showing_tree_01
  prepareAsset(productShowingModel, true);
  productShowingModel.position.set(2.5, 0, -9.0);
  scene.add(productShowingModel);
  autoScaleAndGround(productShowingModel, 2.0);

  prepareAsset(showingTreeModel, true);
  showingTreeModel.position.set(2.5, 0, 9.0);
  scene.add(showingTreeModel);
  autoScaleAndGround(showingTreeModel, 2.8);

  // 4. Village picture — hung on the RIGHT wall (X=11, no video screens)
  // Target: Z=-18 (midpoint between pillar Z=-21 and pillar Z=-15, in empty wall section)
  {
    prepareAsset(villagePictureModel, false);

    // --- Step 1: Strip non-mesh leaf nodes (FBX helpers, empties, locators, etc.) ---
    const vpNodesToRemove = [];
    villagePictureModel.traverse(child => {
      if (child === villagePictureModel) return;
      if (!child.isMesh && child.children.length === 0) {
        vpNodesToRemove.push(child);
      }
    });
    vpNodesToRemove.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });
    console.log(`[VillagePicture] Stripped ${vpNodesToRemove.length} non-mesh leaf node(s)`);

    // Log remaining mesh hierarchy
    let vpMeshCount = 0;
    villagePictureModel.traverse(child => {
      if (child.isMesh) {
        vpMeshCount++;
        console.log(`[VillagePicture]   Mesh: "${child.name}"`);
      }
    });
    console.log(`[VillagePicture] Total meshes: ${vpMeshCount}`);

    // --- Step 2: Reset transforms and compute raw bounding box ---
    villagePictureModel.position.set(0, 0, 0);
    villagePictureModel.rotation.set(0, 0, 0);
    villagePictureModel.scale.set(1, 1, 1);
    villagePictureModel.updateMatrixWorld(true);

    const vpRawBox = new THREE.Box3().setFromObject(villagePictureModel);
    const vpRawSize = new THREE.Vector3();
    vpRawBox.getSize(vpRawSize);
    const vpRawCenter = new THREE.Vector3();
    vpRawBox.getCenter(vpRawCenter);

    console.log(`[VillagePicture] Raw size: X=${vpRawSize.x.toFixed(3)}, Y=${vpRawSize.y.toFixed(3)}, Z=${vpRawSize.z.toFixed(3)}`);
    console.log(`[VillagePicture] Raw center: (${vpRawCenter.x.toFixed(3)}, ${vpRawCenter.y.toFixed(3)}, ${vpRawCenter.z.toFixed(3)})`);

    // --- Step 3: Normalize pivot — shift model so its bounding-box center is at (0,0,0) ---
    villagePictureModel.position.sub(vpRawCenter);

    // Wrap in a parent Group — all further transforms go on this group only
    const vpGroup = new THREE.Group();
    vpGroup.add(villagePictureModel);

    // --- Step 4: Uniform scale to target height (1.8m) ---
    const vpTargetH = 1.8;
    const vpScaleFactor = vpTargetH / vpRawSize.y;
    vpGroup.scale.set(vpScaleFactor, vpScaleFactor, vpScaleFactor);

    // --- Step 5: Auto-detect thin axis and rotate to align with the right wall ---
    // Right wall at X=11 has inward normal pointing toward -X.
    // The picture's thinnest dimension is its depth/thickness.
    // We need this thin axis to align with world X so the picture is parallel to the wall.
    const minDim = Math.min(vpRawSize.x, vpRawSize.y, vpRawSize.z);
    const dimTolerance = minDim * 0.1 + 0.001;

    if (Math.abs(vpRawSize.z - minDim) < dimTolerance) {
      // Z is thin → rotate Y by -π/2 so content face points toward -X (into corridor)
      // +π/2 had the back facing outward; adding π flips the content side out
      vpGroup.rotation.y = -Math.PI / 2;
      console.log('[VillagePicture] Thin axis: Z → rotated Y = -90° (content faces corridor)');
    } else if (Math.abs(vpRawSize.x - minDim) < dimTolerance) {
      // X is already thin → rotate π to flip content face toward -X
      vpGroup.rotation.y = Math.PI;
      console.log('[VillagePicture] Thin axis: X → rotated Y = 180° (content faces corridor)');
    } else {
      // Y is thin (unusual) → rotate to fix
      vpGroup.rotation.y = -Math.PI / 2;
      vpGroup.rotation.z = Math.PI / 2;
      console.log('[VillagePicture] Thin axis: Y (unusual) → compound rotation applied');
    }

    // --- Step 6: Compute bounding box after scale + rotation, group at origin ---
    vpGroup.position.set(0, 0, 0);
    vpGroup.updateMatrixWorld(true);
    const vpScaledBox = new THREE.Box3().setFromObject(vpGroup);

    // --- Step 7: Position so back face is 2cm from wall, centered at Z=-18, Y=2.2 ---
    const vpWallX = 11.0;
    const vpWallGap = 0.02; // 2cm gap to avoid z-fighting

    // X: back face (max X) → wallX - gap
    const vpPosX = (vpWallX - vpWallGap) - vpScaledBox.max.x;
    // Y: center at 2.2m hanging height
    const vpCenterY = (vpScaledBox.min.y + vpScaledBox.max.y) / 2;
    const vpPosY = 2.2 - vpCenterY;
    // Z: center at -18.0
    const vpCenterZ = (vpScaledBox.min.z + vpScaledBox.max.z) / 2;
    const vpPosZ = -18.0 - vpCenterZ;

    vpGroup.position.set(vpPosX, vpPosY, vpPosZ);
    scene.add(vpGroup);
    villagePictureGroup = vpGroup;

    // --- Step 8: Final verification ---
    vpGroup.updateMatrixWorld(true);
    const vpVerifyBox = new THREE.Box3().setFromObject(vpGroup);
    const vpVerifySize = new THREE.Vector3();
    vpVerifyBox.getSize(vpVerifySize);
    console.log(`[VillagePicture] ── Final Report ──`);
    console.log(`[VillagePicture] Position: (${vpGroup.position.x.toFixed(3)}, ${vpGroup.position.y.toFixed(3)}, ${vpGroup.position.z.toFixed(3)})`);
    console.log(`[VillagePicture] Rotation Y: ${(vpGroup.rotation.y * 180 / Math.PI).toFixed(1)}°`);
    console.log(`[VillagePicture] Scale: ${vpGroup.scale.x.toFixed(5)}`);
    console.log(`[VillagePicture] BBox: X[${vpVerifyBox.min.x.toFixed(3)}, ${vpVerifyBox.max.x.toFixed(3)}]  Y[${vpVerifyBox.min.y.toFixed(3)}, ${vpVerifyBox.max.y.toFixed(3)}]  Z[${vpVerifyBox.min.z.toFixed(3)}, ${vpVerifyBox.max.z.toFixed(3)}]`);
    console.log(`[VillagePicture] Size: ${vpVerifySize.x.toFixed(3)} × ${vpVerifySize.y.toFixed(3)} × ${vpVerifySize.z.toFixed(3)}`);
    console.log(`[VillagePicture] Wall gap (back→wall): ${(vpWallX - vpVerifyBox.max.x).toFixed(3)} m`);
  }

  // 5. Mortar — placed on the floor, scaled up 30% from default
  prepareAsset(mortarModel, true);
  autoScaleAndGround(mortarModel, 1.0); // Scale to ~1.0m baseline height
  // Apply 30% enlargement on top of the auto-scaled result
  const mortarCurrentScale = mortarModel.scale.clone();
  mortarModel.scale.set(
    mortarCurrentScale.x * 1.3,
    mortarCurrentScale.y * 1.3,
    mortarCurrentScale.z * 1.3
  );
  // Position: right side of corridor, shifted slightly to Z=-3.5 to accommodate the cabin
  mortarModel.position.set(5.5, 0, -3.5);
  CharacterGrounding.ground(mortarModel);
  scene.add(mortarModel);
  mortarGroup = mortarModel;

  // 6. Paper showing — hung on the RIGHT wall at Z=-6 (between pillar Z=-9 and pillar Z=-3)
  {
    prepareAsset(paperShowingModel, false);

    // Strip non-mesh leaf nodes
    const psNodesToRemove = [];
    paperShowingModel.traverse(child => {
      if (child === paperShowingModel) return;
      if (!child.isMesh && child.children.length === 0) {
        psNodesToRemove.push(child);
      }
    });
    psNodesToRemove.forEach(obj => { if (obj.parent) obj.parent.remove(obj); });

    // Reset transforms and compute raw bounding box
    paperShowingModel.position.set(0, 0, 0);
    paperShowingModel.rotation.set(0, 0, 0);
    paperShowingModel.scale.set(1, 1, 1);
    paperShowingModel.updateMatrixWorld(true);

    const psRawBox = new THREE.Box3().setFromObject(paperShowingModel);
    const psRawSize = new THREE.Vector3();
    psRawBox.getSize(psRawSize);
    const psRawCenter = new THREE.Vector3();
    psRawBox.getCenter(psRawCenter);

    console.log(`[PaperShowing] Raw size: X=${psRawSize.x.toFixed(3)}, Y=${psRawSize.y.toFixed(3)}, Z=${psRawSize.z.toFixed(3)}`);

    // Normalize pivot
    paperShowingModel.position.sub(psRawCenter);
    const psGroup = new THREE.Group();
    psGroup.add(paperShowingModel);

    // Uniform scale to 1.6m height
    const psTargetH = 3.2;
    const psScaleFactor = psTargetH / psRawSize.y;
    psGroup.scale.set(psScaleFactor, psScaleFactor, psScaleFactor);

    // Auto-detect thin axis and rotate (content face toward -X = corridor)
    const psMinDim = Math.min(psRawSize.x, psRawSize.y, psRawSize.z);
    const psTol = psMinDim * 0.1 + 0.001;

    if (Math.abs(psRawSize.z - psMinDim) < psTol) {
      psGroup.rotation.y = -Math.PI / 2;
    } else if (Math.abs(psRawSize.x - psMinDim) < psTol) {
      psGroup.rotation.y = Math.PI;
    } else {
      psGroup.rotation.y = -Math.PI / 2;
      psGroup.rotation.z = Math.PI / 2;
    }

    // Compute bounding box after scale + rotation
    psGroup.position.set(0, 0, 0);
    psGroup.updateMatrixWorld(true);
    const psScaledBox = new THREE.Box3().setFromObject(psGroup);

    // Position: back at wall X=11 with 2cm gap, center Y=2.2, center Z=-6.0
    const psWallX = 11.0;
    const psGap = 0.02;
    const psPosX = (psWallX - psGap) - psScaledBox.max.x;
    const psCenterY = (psScaledBox.min.y + psScaledBox.max.y) / 2;
    const psPosY = 2.2 - psCenterY;
    const psCenterZ = (psScaledBox.min.z + psScaledBox.max.z) / 2;
    const psPosZ = -6.0 - psCenterZ;

    psGroup.position.set(psPosX, psPosY, psPosZ);
    scene.add(psGroup);

    // Verification
    psGroup.updateMatrixWorld(true);
    const psVerifyBox = new THREE.Box3().setFromObject(psGroup);
    const psVerifySize = new THREE.Vector3();
    psVerifyBox.getSize(psVerifySize);
    console.log(`[PaperShowing] Position: (${psGroup.position.x.toFixed(3)}, ${psGroup.position.y.toFixed(3)}, ${psGroup.position.z.toFixed(3)})`);
    console.log(`[PaperShowing] Rotation Y: ${(psGroup.rotation.y * 180 / Math.PI).toFixed(1)}°`);
    console.log(`[PaperShowing] Scale: ${psGroup.scale.x.toFixed(5)}`);
    console.log(`[PaperShowing] Size: ${psVerifySize.x.toFixed(3)} × ${psVerifySize.y.toFixed(3)} × ${psVerifySize.z.toFixed(3)}`);
    console.log(`[PaperShowing] Wall gap: ${(psWallX - psVerifyBox.max.x).toFixed(3)} m`);
    paperGroup = psGroup;
  }

  // 7. Wooden mould — placed on the floor at Z=18
  prepareAsset(woodenMouldModel, true);
  woodenMouldModel.position.set(4.0, 0, 18.0);
  scene.add(woodenMouldModel);
  autoScaleAndGround(woodenMouldModel, 1.2);
  woodenMouldGroup = woodenMouldModel;

  // 8. Cabin — placed in the center of the architecture
  prepareAsset(cabinModel, true);
  cabinModel.position.set(1.5, 0, 0.0);
  scene.add(cabinModel);
  autoScaleAndGround(cabinModel, 1.8);

  // 9. Product showing 02 — placed at a balanced location (Z=24)
  prepareAsset(productShowing02Model, true);
  productShowing02Model.position.set(2.5, 0, 24.0);
  scene.add(productShowing02Model);
  autoScaleAndGround(productShowing02Model, 1.2);
  productGroup = productShowing02Model;

  // 10. Information Plaque/Stele
  plaque = new Plaque(8.0, -12.0, -Math.PI / 2);
  scene.add(plaque.group);

  // 11. Four new floor exhibits
  const newExhibitsData = createFourNewExhibits(scene);
  newExhibitsData.forEach(ex => {
    if (ex.id === 'historical_paper_pedestal') pedestalGroup = { position: ex.position };
    else if (ex.id === 'traditional_paper_drying_rack') dryingGroup = { position: ex.position };
    else if (ex.id === 'do_paper_printing_display') printingGroup = { position: ex.position };
    else if (ex.id === 'yen_thai_village_diorama') dioramaGroup = { position: ex.position };
  });

  const guideMixer = new THREE.AnimationMixer(guideModel);
  const guideActions = {
    idle: guideMixer.clipAction(idleAnim.animations[0]),
    walk: guideMixer.clipAction(walkAnim.animations[0]),
    talk: guideMixer.clipAction(talkingAnim.animations[0])
  };

  const guideFSM = new GuideFSM(guideModel, guideMixer, guideActions);

  // 3. Initialize Tour Manager
  tourManager = new TourManager(
    scene, camera, controls,
    playerModel, playerMixer, playerActions,
    guideModel, guideFSM, stations
  );

  // Track mixers
  mixers = [playerMixer, guideMixer];

}).catch(err => {
  console.error('[FBXLoader] ❌ Thất bại:', err.message);
  console.log('[FBXLoader] Fallback: tạo các hình khối thay thế');

  // Fallback setup for scene
  createMuseumCorridor(scene);
  stations = createExhibitionWall(scene);
  videoActivationSystem = new VideoActivationSystem(stations);

  const geo = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x44aaff });

  const playerModel = new THREE.Mesh(geo, mat);
  playerModel.position.set(0, 0, -32);
  playerModel.castShadow = false;
  playerModel.receiveShadow = false;
  playerModel.visible = false; // Hide fallback player too
  scene.add(playerModel);
  character = playerModel;
  CharacterGrounding.ground(playerModel);

  const guideModel = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffaa44 }));
  guideModel.position.set(-1.5, 0, -28);
  guideModel.castShadow = true;
  guideModel.receiveShadow = false;
  scene.add(guideModel);
  CharacterGrounding.ground(guideModel, -0.92);

  // Fallback for product_showing: a cylinder/box
  const productFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 })
  );
  productFallback.position.set(2.5, 0, -9.0);
  scene.add(productFallback);
  CharacterGrounding.ground(productFallback);

  // Fallback for showing_tree_01: a green cone on a brown trunk
  const treeFallback = new THREE.Group();
  treeFallback.position.set(2.5, 0, 9.0);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 })
  );
  trunk.position.y = 0.4;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d7044, roughness: 0.9 })
  );
  leaves.position.y = 1.9;
  treeFallback.add(trunk, leaves);
  scene.add(treeFallback);
  CharacterGrounding.ground(treeFallback);

  // Fallback for village_picture: a flat canvas on the right wall
  const pictureFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.4, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x8b6f47, roughness: 0.6 })
  );
  pictureFallback.position.set(10.75, 2.2, -18.0);
  scene.add(pictureFallback);
  villagePictureGroup = pictureFallback;

  // Fallback for mortar: a stone-colored cylinder
  const mortarFallback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d8072, roughness: 0.85 })
  );
  mortarFallback.position.set(5.5, 0, -3.5);
  scene.add(mortarFallback);
  CharacterGrounding.ground(mortarFallback);
  mortarGroup = mortarFallback;

  // Fallback for paper_showing: a flat canvas on the right wall at Z=-6
  const paperFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.2, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd4c9a8, roughness: 0.5 })
  );
  paperFallback.position.set(10.95, 2.2, -6.0);
  scene.add(paperFallback);
  paperGroup = paperFallback;

  // Fallback for wooden mould
  const mouldFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 })
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

  // Mock animation clips & actions
  const mockAction = () => ({
    play: () => {}, reset: () => {}, fadeIn: function() { return this; }, fadeOut: () => {}, setEffectiveWeight: () => {}
  });
  const mockActions = { idle: mockAction(), walk: mockAction(), talk: mockAction() };
  playerModel.userData.actions = mockActions;

  const guideFSM = new GuideFSM(guideModel, null, mockActions);

  tourManager = new TourManager(
    scene, camera, controls,
    playerModel, null, mockActions,
    guideModel, guideFSM, stations
  );

  // Pre-load all video displays at startup in fallback too
  stations.forEach(station => {
    station.videoDisplay.load();
  });

  // Remove loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 500);
  }
});

function fadeToAction(action) {
  if (currentAction === action) return;
  if (currentAction) currentAction.fadeOut(0.2);
  action.reset().fadeIn(0.2).play();
  currentAction = action;
}

function updateMovement(delta) {
  if (!character) return;

  // 1. Lock camera position and controls target to player's head for first-person
  const headPos = new THREE.Vector3().copy(character.position).add(new THREE.Vector3(0, 1.3, 0));
  
  // Calculate current camera direction
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  
  // Align OrbitControls target slightly in front of the camera, centered at headPos
  controls.target.copy(headPos).addScaledVector(dir, 0.05);
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

  // Update tour manager logic (e.g. check proximity for follow button)
  if (tourManager) {
    tourManager.update(delta, clock.getElapsedTime());
  }

  // Handle manual player controls (movement relative to camera horizontal direction)
  const input = new THREE.Vector3();
  if (keys.w) input.z -= 1;
  if (keys.s) input.z += 1;
  if (keys.a) input.x -= 1;
  if (keys.d) input.x += 1;

  if (input.lengthSq() > 0) {
    input.normalize();
    
    // Get horizontal camera heading vectors
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up);
    right.y = 0;
    right.normalize();

    // Combine direction vectors
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, -input.z); // input.z is -1 for W (forward)
    moveDir.addScaledVector(right, input.x);
    moveDir.normalize();

    const speedLimit = keys[' '] ? maxSpeed * 2.2 : maxSpeed;
    velocity.x = moveDir.x * speedLimit;
    velocity.z = moveDir.z * speedLimit;
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
  
  // Bounds check matching 22m x 70m corridor limits
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

  colliders.forEach(col => {
    const dx = newX - col.x;
    const dz = newZ - col.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = col.radius + 0.45; // Combined radius (object + player)
    if (dist < minDist) {
      const pushDist = minDist - dist;
      if (dist > 0.001) {
        newX += (dx / dist) * pushDist;
        newZ += (dz / dist) * pushDist;
      } else {
        newX += minDist;
      }
    }
  });

  character.position.x = newX;
  character.position.z = newZ;

  // No player model rotation/skinning update needed since it is invisible in first-person
}

document.addEventListener('keydown', e => {
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

  if (key in keys) {
    keys[key] = true;
    e.preventDefault();
  }
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
    e.preventDefault();
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

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

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  checkUIAndUnlock();

  updateMovement(delta);

  // Update ceiling fans rotation
  updateCeilingFans(delta);

  // Update video activation system (handles playback, loading, and culling)
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
    const shouldUpdateGuide = (tourManager.playerState !== PLAYER_STATES.FREE) || 
                              (character && character.position.distanceTo(tourManager.guide.position) < 15);
    if (shouldUpdateGuide) {
      mixers[1].update(delta);
    }
  }

  if (tourManager && tourManager.guide) {
    uiController.updateGuideAskBubble(camera, tourManager.guide);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
