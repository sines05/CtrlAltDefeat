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

const scene = new THREE.Scene();
let videoActivationSystem;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 3, -35); // Start closer to the entrance walkway
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

// Sun Light (Warm golden sunlight filtering from gaps)
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

let character; // The user's controllable player character
let currentAction;
let isTalking = false;
let mixers = [];
let tourManager = null;
let stations = [];

const keys = { w: false, a: false, s: false, d: false, ' ': false };
const velocity = new THREE.Vector3();
const acceleration = 12;
const maxSpeed = 2.4;
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
]).then(([model, idleAnim, walkAnim, talkingAnim, productShowingModel, showingTreeModel, villagePictureModel, mortarModel, paperShowingModel, woodenMouldModel]) => {
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
  // Position: right side of corridor at Z=0 (center), near pillar line but not blocking walkway
  mortarModel.position.set(5.0, 0, 0);
  CharacterGrounding.ground(mortarModel);
  scene.add(mortarModel);

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
  }

  // 7. Wooden mould — placed on the floor at Z=18
  prepareAsset(woodenMouldModel, true);
  woodenMouldModel.position.set(4.0, 0, 18.0);
  scene.add(woodenMouldModel);
  autoScaleAndGround(woodenMouldModel, 1.2);

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

  // Fallback for mortar: a stone-colored cylinder
  const mortarFallback = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.4, 1.0, 12),
    new THREE.MeshStandardMaterial({ color: 0x8d8072, roughness: 0.85 })
  );
  mortarFallback.position.set(5.0, 0, 0);
  scene.add(mortarFallback);
  CharacterGrounding.ground(mortarFallback);

  // Fallback for paper_showing: a flat canvas on the right wall at Z=-6
  const paperFallback = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.2, 1.8),
    new THREE.MeshStandardMaterial({ color: 0xd4c9a8, roughness: 0.5 })
  );
  paperFallback.position.set(10.95, 2.2, -6.0);
  scene.add(paperFallback);

  // Fallback for wooden mould
  const mouldFallback = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.7 })
  );
  mouldFallback.position.set(4.0, 0.6, 18.0);
  scene.add(mouldFallback);

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

  // Collision with floor objects (product_showing, showing_tree_01, mortar)
  const colliders = [
    { x: 2.5, z: -9.0, radius: 1.6 },  // product_showing
    { x: 2.5, z: 9.0, radius: 1.5 },   // showing_tree_01
    { x: 5.0, z: 0, radius: 1.0 },     // mortar
    { x: 4.0, z: 18.0, radius: 1.2 }   // wooden mould
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
  // Disable keyboard keys if typing in the modal
  if (tourManager && tourManager.playerState === PLAYER_STATES.QUESTION_INPUT) {
    return;
  }

  const key = e.key.toLowerCase();
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

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  updateMovement(delta);

  // Update ceiling fans rotation
  updateCeilingFans(delta);

  // Update video activation system (handles playback, loading, and culling)
  const time = clock.getElapsedTime();
  if (videoActivationSystem && character) {
    videoActivationSystem.update(time, character.position, tourManager ? tourManager.guide.position : null);
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
