import * as THREE from 'three';

function createStoneFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Warm beige traditional stone tiles base
  ctx.fillStyle = '#d2c7a3';
  ctx.fillRect(0, 0, 512, 512);
  
  // Add natural stone texture grain/noise
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = Math.random() * 1.2 + 0.5;
    const opacity = Math.random() * 0.04 + 0.01;
    ctx.fillStyle = Math.random() > 0.55 ? `rgba(255,255,255,${opacity})` : `rgba(130,110,90,${opacity * 0.7})`;
    ctx.fillRect(x, y, size, size);
  }
  
  // Draw mortar lines
  ctx.strokeStyle = '#b6ae93';
  ctx.lineWidth = 3;
  const tileSize = 128;
  for (let x = 0; x <= 512; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Tile Size repeats: 16 horizontal x 52 vertical tile repeats
  texture.repeat.set(16, 52);
  return texture;
}

function createWoodenBench(scene, x, z, woodMaterial) {
  const bench = new THREE.Group();
  bench.position.set(x, 0, z);
  
  // Seat plank
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.45), woodMaterial);
  seat.position.y = 0.45;
  seat.castShadow = true;
  bench.add(seat);
  
  // Left leg
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.41, 0.4), woodMaterial);
  leg1.position.set(-0.75, 0.205, 0);
  leg1.castShadow = true;
  bench.add(leg1);
  
  // Right leg
  const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.41, 0.4), woodMaterial);
  leg2.position.set(0.75, 0.205, 0);
  leg2.castShadow = true;
  bench.add(leg2);
  
  scene.add(bench);
}

function createPlantPot(scene, x, z) {
  const potGroup = new THREE.Group();
  potGroup.position.set(x, 0, z);
  
  // Clay pot
  const potMat = new THREE.MeshStandardMaterial({ color: 0xa16f5c, roughness: 0.8 }); // warm terracotta clay
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.5, 8), potMat);
  pot.position.y = 0.25;
  pot.castShadow = true;
  potGroup.add(pot);
  
  // Plant leaves
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3d7044, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), leafMat);
    leaf.position.set(
      (Math.random() - 0.5) * 0.08,
      0.5 + Math.random() * 0.06,
      (Math.random() - 0.5) * 0.08
    );
    leaf.rotation.set(
      0.25 + Math.random() * 0.35,
      Math.random() * Math.PI,
      0.25 + Math.random() * 0.35
    );
    potGroup.add(leaf);
  }
  
  scene.add(potGroup);
}

const ceilingFans = [];

function createCeilingFan(scene, x, y, z) {
  const fanGroup = new THREE.Group();
  fanGroup.position.set(x, y, z);

  // 1. Canopy (mount to beam)
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, // Matte black/dark metal
    roughness: 0.6,
    metalness: 0.8
  });
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.08, 0.08, 12),
    canopyMat
  );
  canopy.position.y = 0;
  canopy.castShadow = true;
  fanGroup.add(canopy);

  // 2. Downrod
  const downrod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.7, 8),
    canopyMat
  );
  downrod.position.y = -0.35;
  downrod.castShadow = true;
  fanGroup.add(downrod);

  // 3. Motor Housing (hub)
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x222222, // Matte dark metal
    roughness: 0.4,
    metalness: 0.7
  });
  const motorHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16),
    motorMat
  );
  motorHub.position.y = -0.7;
  motorHub.castShadow = true;
  fanGroup.add(motorHub);

  // Add decorative brass/gold ring on motor housing for premium look
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059, // Antique gold
    roughness: 0.3,
    metalness: 0.9
  });
  const accentRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.245, 0.245, 0.02, 16),
    accentMat
  );
  accentRing.position.y = -0.7;
  fanGroup.add(accentRing);

  // 4. Blades Group (this is the part we will rotate)
  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, -0.73, 0);
  fanGroup.add(bladesGroup);

  // Create 5 blades
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723, // Rich dark mahogany wood
    roughness: 0.7,
    metalness: 0.1
  });
  const bladeGeo = new THREE.BoxGeometry(1.0, 0.015, 0.12);

  // Blade iron connector (connects blade to hub)
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.6,
    metalness: 0.8
  });
  const ironGeo = new THREE.BoxGeometry(0.2, 0.015, 0.04);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    
    // Create a sub-group for the blade + iron connector to make it easier to offset and tilt
    const singleBladeGroup = new THREE.Group();
    singleBladeGroup.rotation.y = angle;

    // Iron connector mesh
    const iron = new THREE.Mesh(ironGeo, ironMat);
    iron.position.set(0.12, 0, 0);
    iron.castShadow = true;
    singleBladeGroup.add(iron);

    // Blade mesh
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.7, -0.01, 0);
    blade.rotation.x = 0.12; // ~7 degrees pitch
    blade.castShadow = true;
    singleBladeGroup.add(blade);

    bladesGroup.add(singleBladeGroup);
  }

  scene.add(fanGroup);
  ceilingFans.push(bladesGroup);
}

export function updateCeilingFans(delta) {
  ceilingFans.forEach(fan => {
    fan.rotation.y += 2.5 * delta;
  });
}

export function createMuseumCorridor(scene) {
  ceilingFans.length = 0;

  // Set bright, warm traditional background and fog
  const bgColor = 0xe8dcbf; // Soft warm beige plaster tint
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.FogExp2(bgColor, 0.022); // Gentler, more open fog

  const corridorLength = 70; // 70 meters long
  const corridorWidth = 22;   // 22 meters wide (expanded by ~50% from 15m)
  const height = 6.2;         // 6.2 meters high

  // 1. Tiled Stone Floor (Warm beige natural stone)
  const floorGeo = new THREE.PlaneGeometry(corridorWidth, corridorLength);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createStoneFloorTexture(),
    roughness: 0.9,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 2. Ivory Plaster Walls (Beige walls to enclose the space and reflect light)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xe3d9c3, // Soft warm beige plaster
    roughness: 0.95,
    metalness: 0.0
  });

  const wallGeo = new THREE.PlaneGeometry(corridorLength, height);
  const halfWidth = corridorWidth / 2;
  const halfLength = corridorLength / 2;

  // Left Wall
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-halfWidth, height / 2, 0);
  leftWall.rotation.y = Math.PI / 2; // Face inward
  scene.add(leftWall);

  // Right Wall
  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(halfWidth, height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2; // Face inward
  scene.add(rightWall);

  // End Wall (Back)
  const endWallGeo = new THREE.PlaneGeometry(corridorWidth, height);
  const backWall = new THREE.Mesh(endWallGeo, wallMat);
  backWall.position.set(0, height / 2, -halfLength);
  scene.add(backWall);

  // End Wall (Front)
  const frontWall = new THREE.Mesh(endWallGeo, wallMat);
  frontWall.position.set(0, height / 2, halfLength);
  frontWall.rotation.y = Math.PI; // Face inward
  scene.add(frontWall);

  // 3. Columns, Beams, Rafters (Light oak wood / warm natural timber)
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xba9566, // Warm timber
    roughness: 0.75,
    metalness: 0.0,
  });

  const pillarSpacing = 6; // Pillars every 6m
  const pillarX = 9.2; // Placed wider to match the 22m wide corridor

  // Reuse geometry objects
  const pillarGeo = new THREE.CylinderGeometry(0.18, 0.22, height, 12);
  const crossBeamGeo = new THREE.BoxGeometry(pillarX * 2, 0.18, 0.18);
  const rafterGeo = new THREE.BoxGeometry(pillarX + 0.8, 0.12, 0.12);

  let beamIndex = 0;
  for (let z = -halfLength + 2; z <= halfLength - 2; z += pillarSpacing) {
    // Left Pillar
    const leftPillar = new THREE.Mesh(pillarGeo, woodMaterial);
    leftPillar.position.set(-pillarX, height / 2, z);
    scene.add(leftPillar);

    // Right Pillar
    const rightPillar = new THREE.Mesh(pillarGeo, woodMaterial);
    rightPillar.position.set(pillarX, height / 2, z);
    scene.add(rightPillar);

    // Cross beam (Horizontal tie-beam)
    const crossBeam = new THREE.Mesh(crossBeamGeo, woodMaterial);
    crossBeam.position.set(0, height - 0.2, z);
    scene.add(crossBeam);

    // Ceiling Fan hanging from the center of this beam (only 4 fans total)
    if (beamIndex % 3 === 1) {
      createCeilingFan(scene, 0, height - 0.29, z);
    }
    beamIndex++;

    // Diagonal roof rafter structures (Traditional truss shape)
    const rafterLeft = new THREE.Mesh(rafterGeo, woodMaterial);
    rafterLeft.position.set(-pillarX / 2, height + 1.0, z);
    rafterLeft.rotation.z = Math.PI / 10; // angled up
    scene.add(rafterLeft);

    const rafterRight = new THREE.Mesh(rafterGeo, woodMaterial);
    rafterRight.position.set(pillarX / 2, height + 1.0, z);
    rafterRight.rotation.z = -Math.PI / 10; // angled up
    scene.add(rafterRight);
  }

  // 4. Longitudinal beams along the corridor length
  const longBeamGeo = new THREE.BoxGeometry(0.16, 0.16, corridorLength);
  
  const longBeamLeft = new THREE.Mesh(longBeamGeo, woodMaterial);
  longBeamLeft.position.set(-pillarX, height - 0.2, 0);
  scene.add(longBeamLeft);

  const longBeamRight = new THREE.Mesh(longBeamGeo, woodMaterial);
  longBeamRight.position.set(pillarX, height - 0.2, 0);
  scene.add(longBeamRight);

  // Roof ridge beam (center top)
  const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, corridorLength), woodMaterial);
  ridgeBeam.position.set(0, height + 2.2, 0);
  scene.add(ridgeBeam);

  // Purlins (intermediate longitudinal rafters running parallel to ridge beam)
  const purlinGeo = new THREE.BoxGeometry(0.14, 0.14, corridorLength);
  const purlinLeft = new THREE.Mesh(purlinGeo, woodMaterial);
  purlinLeft.position.set(-pillarX * 0.5, height + 0.85, 0);
  scene.add(purlinLeft);

  const purlinRight = new THREE.Mesh(purlinGeo, woodMaterial);
  purlinRight.position.set(pillarX * 0.5, height + 0.85, 0);
  scene.add(purlinRight);

  // 5. Ceiling Planks (Bright cream ivory planks matching the walls)
  const roofPlaneGeo = new THREE.PlaneGeometry(pillarX + 1.8, corridorLength);
  const roofPlaneMat = new THREE.MeshStandardMaterial({ 
    color: 0xe4d8be, // Warm cream plaster ceiling
    roughness: 0.95 
  });

  const roofPlaneLeft = new THREE.Mesh(roofPlaneGeo, roofPlaneMat);
  roofPlaneLeft.position.set(-pillarX / 2, height + 1.1, 0);
  roofPlaneLeft.rotation.x = Math.PI / 2;
  roofPlaneLeft.rotation.y = -Math.PI / 10; // Match rafter angle
  scene.add(roofPlaneLeft);

  const roofPlaneRight = new THREE.Mesh(roofPlaneGeo, roofPlaneMat);
  roofPlaneRight.position.set(pillarX / 2, height + 1.1, 0);
  roofPlaneRight.rotation.x = Math.PI / 2;
  roofPlaneRight.rotation.y = Math.PI / 10; // Match rafter angle
  scene.add(roofPlaneRight);

  // 6. Wall Details (Skirting and trims to enhance character)
  const skirtingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, corridorLength), woodMaterial);
  skirtingLeft.position.set(-halfWidth + 0.06, 0.14, 0);
  scene.add(skirtingLeft);

  const skirtingRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, corridorLength), woodMaterial);
  skirtingRight.position.set(halfWidth - 0.06, 0.14, 0);
  scene.add(skirtingRight);

  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, corridorLength), woodMaterial);
  trimLeft.position.set(-halfWidth + 0.04, height - 1.2, 0);
  scene.add(trimLeft);

  const trimRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, corridorLength), woodMaterial);
  trimRight.position.set(halfWidth - 0.04, height - 1.2, 0);
  scene.add(trimRight);

  // 7. Small Environment Details (benches and plant pots)
  createWoodenBench(scene, halfWidth - 1.0, -15, woodMaterial);
  createWoodenBench(scene, halfWidth - 1.0, 3, woodMaterial);
  createWoodenBench(scene, halfWidth - 1.0, 21, woodMaterial);

  createPlantPot(scene, halfWidth - 1.0, -21);
  createPlantPot(scene, halfWidth - 1.0, -9);
  createPlantPot(scene, halfWidth - 1.0, -3);
  createPlantPot(scene, halfWidth - 1.0, 9);
  createPlantPot(scene, halfWidth - 1.0, 15);
  createPlantPot(scene, halfWidth - 1.0, 27);

  // Corner green accents
  createPlantPot(scene, -halfWidth + 1.0, -halfLength + 2.0);
  createPlantPot(scene, halfWidth - 1.0, -halfLength + 2.0);
  createPlantPot(scene, -halfWidth + 1.0, halfLength - 2.0);
  createPlantPot(scene, halfWidth - 1.0, halfLength - 2.0);

  // 8. Ambient and Indirect Lighting
  const ambientLight = new THREE.AmbientLight(0xffe9be, 1.2); // Warm cozy golden-yellow ambient fill light
  scene.add(ambientLight);

  // Warm PointLights along the corridor (adjusted to a richer warm amber/yellow color)
  const pointLight1 = new THREE.PointLight(0xffc875, 3.5, 40, 1.0);
  pointLight1.position.set(0, height - 1.2, -18);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xffc875, 3.5, 40, 1.0);
  pointLight2.position.set(0, height - 1.2, 0);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0xffc875, 3.5, 40, 1.0);
  pointLight3.position.set(0, height - 1.2, 18);
  scene.add(pointLight3);

  // Reused lamp geometry and material
  const lampGeo = new THREE.CylinderGeometry(0.15, 0.1, 0.25, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xc89e6c, metalness: 0.2, roughness: 0.4 });

  // Place visual lamp models at rafters
  for (let z = -halfLength + 6; z <= halfLength - 6; z += 12) {
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, height - 0.1, z);
    scene.add(lamp);
  }
}
