import * as THREE from 'three';

export function createRightSideExhibits(scene) {
  const exhibits = [];
  
  // Reuse wood and stone materials
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c3e21, // Dark aged wood
    roughness: 0.8,
    metalness: 0.1
  });
  
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    roughness: 0.1,
    transmission: 0.9,
    thickness: 0.5
  });
  
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a8279,
    roughness: 0.9
  });
  
  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4eedb, // Warm ivory
    roughness: 0.9,
    metalness: 0.0
  });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059,
    roughness: 0.3,
    metalness: 0.8
  });

  // A. NGUYÊN LIỆU THÔ (Low glass case at X = 8.0, Z = -24.0)
  const rawMaterialGroup = new THREE.Group();
  rawMaterialGroup.position.set(8.0, 0, -24.0);
  
  // Table base
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.9), woodMaterial);
  tableTop.position.y = 0.75;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  rawMaterialGroup.add(tableTop);
  
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7);
  for (let dx of [-0.7, 0.7]) {
    for (let dz of [-0.35, 0.35]) {
      const leg = new THREE.Mesh(legGeo, woodMaterial);
      leg.position.set(dx, 0.35, dz);
      leg.castShadow = true;
      rawMaterialGroup.add(leg);
    }
  }
  
  // Glass case
  const glassCase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.8), glassMaterial);
  glassCase.position.y = 1.05;
  rawMaterialGroup.add(glassCase);
  
  // Contents inside glass case
  // 1. Dry bark (brown twigs/scrolls)
  const barkGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const bark = new THREE.Mesh(barkGeo, barkMat);
    bark.position.set(-0.5 + i*0.05, 0.82, -0.1 + (i%2)*0.08);
    bark.rotation.set(0.2, 0.1, 1.3);
    rawMaterialGroup.add(bark);
  }
  // 2. Soaked bark (dark wet fibers)
  const soakedMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
  const soaked = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.15), soakedMat);
  soaked.position.set(-0.1, 0.82, 0.05);
  soaked.rotation.y = 0.3;
  rawMaterialGroup.add(soaked);
  // 3. Cleaned fibers (white clumps)
  const fiberGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const fiberMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.95 });
  const fiber = new THREE.Mesh(fiberGeo, fiberMat);
  fiber.scale.set(1.5, 0.8, 1.2);
  fiber.position.set(0.25, 0.84, -0.05);
  rawMaterialGroup.add(fiber);
  // 4. Pulp jar
  const jarMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.1, transparent: true, opacity: 0.4 });
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), jarMat);
  jar.position.set(0.5, 0.89, 0.05);
  rawMaterialGroup.add(jar);
  const pulpInJar = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.12, 8), paperMaterial);
  pulpInJar.position.set(0.5, 0.86, 0.05);
  rawMaterialGroup.add(pulpInJar);
  
  scene.add(rawMaterialGroup);
  exhibits.push({ id: "exhibit_raw_material", position: rawMaterialGroup.position });

  // B. DỤNG CỤ LÀM GIẤY (Open Display at X = 8.0, Z = 6.0)
  const toolsGroup = new THREE.Group();
  toolsGroup.position.set(8.0, 0, 6.0);
  
  // Large low wooden pedestal
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.2), woodMaterial);
  ped.position.y = 0.09;
  ped.receiveShadow = true;
  ped.castShadow = true;
  toolsGroup.add(ped);
  
  // Stone mortar (Cối giã)
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 8), stoneMaterial);
  mortar.position.set(-0.5, 0.43, -0.15);
  mortar.castShadow = true;
  toolsGroup.add(mortar);
  
  // Wooden mallet (Chày giã)
  const malletHead = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), woodMaterial);
  malletHead.position.set(-0.35, 0.72, -0.15);
  malletHead.rotation.x = Math.PI/2;
  malletHead.castShadow = true;
  toolsGroup.add(malletHead);
  const malletHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), woodMaterial);
  malletHandle.position.set(-0.35, 0.5, -0.15);
  malletHandle.rotation.z = 0.2;
  malletHandle.castShadow = true;
  toolsGroup.add(malletHandle);
  
  // Mold frame (Khung xeo & mành)
  const moldFrame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.5), woodMaterial);
  moldFrame.position.set(0.4, 0.21, 0.15);
  moldFrame.rotation.y = 0.25;
  moldFrame.rotation.x = 0.1;
  moldFrame.castShadow = true;
  toolsGroup.add(moldFrame);
  
  const screenBamboo = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.01, 0.46), paperMaterial);
  screenBamboo.position.set(0.4, 0.22, 0.15);
  screenBamboo.rotation.y = 0.25;
  screenBamboo.rotation.x = 0.1;
  toolsGroup.add(screenBamboo);
  
  scene.add(toolsGroup);
  exhibits.push({ id: "exhibit_tools", position: toolsGroup.position });

  // C. BỨC TƯỜNG MẪU GIẤY (Vertical samples on Right Wall: X = 10.7, Z = 12.0)
  const sampleWallGroup = new THREE.Group();
  sampleWallGroup.position.set(10.7, 2.2, 12.0);
  sampleWallGroup.rotation.y = -Math.PI / 2;
  
  // Large backboard
  const backboard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.06), woodMaterial);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  sampleWallGroup.add(backboard);
  
  // Title plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.02), goldAccentMat);
  plate.position.set(0, 0.55, 0.04);
  sampleWallGroup.add(plate);
  
  // 6 paper sheets of different colors/thicknesses
  const colors = [
    0xffffff, // White
    0xfaf0d9, // Ivory
    0xf5e5c0, // Natural
    0xeacc9c, // Dark natural
    0xccbba3, // Tinted greyish
    0xa88d67  // Brown bark paper
  ];
  
  const sheetGeo = new THREE.BoxGeometry(0.45, 0.35, 0.01);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const sheetMat = new THREE.MeshStandardMaterial({
        color: colors[idx],
        roughness: 0.95
      });
      const sheet = new THREE.Mesh(sheetGeo, sheetMat);
      // Position grids
      const x = -0.7 + col * 0.7;
      const y = 0.15 - row * 0.5;
      sheet.position.set(x, y, 0.04);
      sheet.castShadow = true;
      sampleWallGroup.add(sheet);
    }
  }
  
  scene.add(sampleWallGroup);
  exhibits.push({ id: "exhibit_paper_samples", position: new THREE.Vector3(9.5, 1.5, 12.0) });

  // D. BÀN TRẢI NGHIỆM XÚC GIÁC (X = 8.0, Z = -6.0)
  const tactileGroup = new THREE.Group();
  tactileGroup.position.set(8.0, 0, -6.0);
  
  // Wooden table
  const tabTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.8), woodMaterial);
  tabTop.position.y = 0.85;
  tabTop.castShadow = true;
  tabTop.receiveShadow = true;
  tactileGroup.add(tabTop);
  
  const tabLegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.81);
  for (let dx of [-0.6, 0.6]) {
    for (let dz of [-0.3, 0.3]) {
      const leg = new THREE.Mesh(tabLegGeo, woodMaterial);
      leg.position.set(dx, 0.405, dz);
      leg.castShadow = true;
      tactileGroup.add(leg);
    }
  }
  
  // 3 sample sheets laid flat on the table
  const sampleGeo = new THREE.BoxGeometry(0.3, 0.005, 0.4);
  const colorsTactile = [0xfcf9ef, 0xf7eed2, 0xe2d0b5];
  for (let i = 0; i < 3; i++) {
    const sMat = new THREE.MeshStandardMaterial({ color: colorsTactile[i], roughness: 0.99 });
    const sMesh = new THREE.Mesh(sampleGeo, sMat);
    sMesh.position.set(-0.4 + i*0.4, 0.895, 0.05 * (i%2 === 0 ? 1 : -1));
    sMesh.rotation.y = (i - 1) * 0.15;
    sMesh.castShadow = true;
    tactileGroup.add(sMesh);
  }
  
  // Sign stand
  const signBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.14), woodMaterial);
  signBase.position.set(0, 0.9, -0.28);
  tactileGroup.add(signBase);
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12), woodMaterial);
  signPole.position.set(0, 0.97, -0.28);
  tactileGroup.add(signPole);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.02), woodMaterial);
  signBoard.position.set(0, 1.05, -0.28);
  signBoard.rotation.x = -0.3; // Tilt back
  tactileGroup.add(signBoard);
  
  // Text plate inside sign
  const textPlate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.005), paperMaterial);
  textPlate.position.set(0, 1.05, -0.27);
  textPlate.rotation.x = -0.3;
  tactileGroup.add(textPlate);
  
  scene.add(tactileGroup);
  exhibits.push({ id: "exhibit_tactile_table", position: tactileGroup.position });

  // E. DÒNG THỜI GIAN (Timeline Panel on wall: X = 10.8, Z = -30.0)
  const timelineGroup = new THREE.Group();
  timelineGroup.position.set(10.8, 2.2, -30.0);
  timelineGroup.rotation.y = -Math.PI / 2;
  
  const tmBoard = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 0.05), woodMaterial);
  tmBoard.castShadow = true;
  tmBoard.receiveShadow = true;
  timelineGroup.add(tmBoard);
  
  // Inner linen/paper board
  const tmCanvas = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.01), paperMaterial);
  tmCanvas.position.z = 0.03;
  timelineGroup.add(tmCanvas);
  
  // Draw timeline path (copper line)
  const line = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.01, 0.01), goldAccentMat);
  line.position.set(0, -0.1, 0.04);
  timelineGroup.add(line);
  
  // 5 historical milestone dots
  const dotGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8);
  for (let i = 0; i < 5; i++) {
    const dot = new THREE.Mesh(dotGeo, goldAccentMat);
    dot.position.set(-1.0 + i * 0.5, -0.1, 0.045);
    dot.rotation.x = Math.PI/2;
    dot.castShadow = true;
    timelineGroup.add(dot);
    
    // Mini label flags
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.01), woodMaterial);
    flag.position.set(-1.0 + i * 0.5, 0.15 + (i%2)*0.1, 0.04);
    flag.castShadow = true;
    timelineGroup.add(flag);
    
    const flagPaper = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.1, 0.005), paperMaterial);
    flagPaper.position.set(-1.0 + i * 0.5, 0.15 + (i%2)*0.1, 0.045);
    timelineGroup.add(flagPaper);
  }
  
  scene.add(timelineGroup);
  exhibits.push({ id: "exhibit_timeline", position: new THREE.Vector3(9.5, 1.5, -30.0) });

  // 9. END-OF-SPACE EXHIBITION AREA (Z = 28.0 to 34.8)
  const endSpaceGroup = new THREE.Group();
  
  // A. Large suspended paper artwork (X = 0, Y = 3.5, Z = 33.0)
  const artworkGroup = new THREE.Group();
  artworkGroup.position.set(0, 3.5, 33.0);
  
  const mainBanner = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.02), paperMaterial);
  mainBanner.castShadow = true;
  artworkGroup.add(mainBanner);
  
  // Suspended ropes/wires
  const ropeGeo = new THREE.CylinderGeometry(0.006, 0.006, 2.5);
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x423020, roughness: 0.9 });
  for (let dx of [-0.75, 0.75]) {
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(dx, 1.4 + 1.25, 0);
    artworkGroup.add(rope);
  }
  endSpaceGroup.add(artworkGroup);
  
  // B. Translucent hanging sheets at different heights and angles
  const sheetHangingGeo = new THREE.BoxGeometry(0.6, 0.9, 0.008);
  const sheetOffsets = [
    { x: -2.2, y: 3.2, z: 32.2, rY: 0.4 },
    { x: -1.2, y: 2.6, z: 33.4, rY: -0.2 },
    { x: 1.4, y: 2.9, z: 31.8, rY: 0.3 },
    { x: 2.4, y: 3.4, z: 32.8, rY: -0.5 }
  ];
  
  const hangingMat = new THREE.MeshPhysicalMaterial({
    color: 0xfffcf2,
    transparent: true,
    opacity: 0.7,
    roughness: 0.9,
    transmission: 0.5,
    thickness: 0.1
  });
  
  sheetOffsets.forEach(data => {
    const sh = new THREE.Mesh(sheetHangingGeo, hangingMat);
    sh.position.set(data.x, data.y, data.z);
    sh.rotation.y = data.rY;
    sh.castShadow = true;
    
    // Rope for each
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 3), ropeMat);
    r.position.set(data.x, data.y + 0.45 + 1.5, data.z);
    endSpaceGroup.add(r);
    endSpaceGroup.add(sh);
  });
  
  // C. Central display table showing traditional/contemporary products (Z = 31.0, X = 0.0)
  const displayTableGroup = new THREE.Group();
  displayTableGroup.position.set(0, 0, 31.0);
  
  // Octagonal wooden display counter
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.8, 8), woodMaterial);
  counter.position.y = 0.4;
  counter.castShadow = true;
  counter.receiveShadow = true;
  displayTableGroup.add(counter);
  
  // Accent golden ring
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.91, 0.91, 0.04, 8), goldAccentMat);
  ring.position.y = 0.75;
  displayTableGroup.add(ring);
  
  // Products on display
  // 1. Open book (Cuốn sách cổ)
  const bookGeo = new THREE.BoxGeometry(0.3, 0.04, 0.2);
  const bookMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
  const book = new THREE.Mesh(bookGeo, bookMat);
  book.position.set(-0.25, 0.82, -0.1);
  book.rotation.y = 0.4;
  book.castShadow = true;
  displayTableGroup.add(book);
  
  // 2. Scroll (Cuốn thư pháp)
  const scrollGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
  const scroll = new THREE.Mesh(scrollGeo, paperMaterial);
  scroll.position.set(0.2, 0.82, 0.15);
  scroll.rotation.z = Math.PI/2;
  scroll.rotation.y = 0.6;
  scroll.castShadow = true;
  displayTableGroup.add(scroll);
  
  // Glass dome on counter
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    transmission: 0.95,
    thickness: 0.3
  });
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 12, 1, true), domeMat);
  dome.position.y = 0.975;
  displayTableGroup.add(dome);
  const domeRoof = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12, 0, Math.PI*2, 0, Math.PI/2), domeMat);
  domeRoof.position.y = 1.15;
  displayTableGroup.add(domeRoof);
  
  endSpaceGroup.add(displayTableGroup);
  
  // D. Bench facing the end wall (X = 0, Z = 29.0)
  const benchGroup = new THREE.Group();
  benchGroup.position.set(0, 0, 29.0);
  const seatPlank = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.5), woodMaterial);
  seatPlank.position.y = 0.45;
  seatPlank.castShadow = true;
  benchGroup.add(seatPlank);
  
  for (let dx of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.41, 0.45), woodMaterial);
    leg.position.set(dx, 0.205, 0);
    leg.castShadow = true;
    benchGroup.add(leg);
  }
  endSpaceGroup.add(benchGroup);
  
  // E. Freestanding final stele: GÌN GIỮ MỘT DI SẢN SỐNG (X = -4.0, Z = 31.0)
  const finalSteleGroup = new THREE.Group();
  finalSteleGroup.position.set(-4.0, 0, 31.0);
  finalSteleGroup.rotation.y = 0.5; // Rotate to face player coming from corridor
  
  // Stele base (pedestal)
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.75), stoneMaterial);
  base.position.y = 0.125;
  base.castShadow = true;
  base.receiveShadow = true;
  finalSteleGroup.add(base);
  
  // Stele body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.22), stoneMaterial);
  body.position.y = 0.95;
  body.castShadow = true;
  body.receiveShadow = true;
  finalSteleGroup.add(body);
  
  // Plaque inscription plate
  const inscription = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.15, 0.02), woodMaterial);
  inscription.position.set(0, 0.95, 0.12);
  inscription.castShadow = true;
  finalSteleGroup.add(inscription);
  
  const inscriptionPaper = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.09, 0.01), paperMaterial);
  inscriptionPaper.position.set(0, 0.95, 0.13);
  finalSteleGroup.add(inscriptionPaper);
  
  endSpaceGroup.add(finalSteleGroup);
  exhibits.push({ id: "exhibit_final_stele", position: finalSteleGroup.position });
  
  scene.add(endSpaceGroup);

  return exhibits;
}
