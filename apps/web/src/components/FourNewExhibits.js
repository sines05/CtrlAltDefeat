import * as THREE from 'three';

export function createFourNewExhibits(scene) {
  const exhibits = [];

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3e21, roughness: 0.8, metalness: 0.1
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723, roughness: 0.85, metalness: 0.1
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.2,
    roughness: 0.1, transmission: 0.9, thickness: 0.5
  });
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xf4eedb, roughness: 0.9, metalness: 0.0
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8a8279, roughness: 0.9
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059, roughness: 0.3, metalness: 0.8
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: 0xba9566, roughness: 0.8, metalness: 0.05
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x6d4c2a, roughness: 0.9, metalness: 0.0
  });

  // 1. HISTORICAL PAPER PEDESTAL — (5.0, 0, -19.0)
  {
    const group = new THREE.Group();
    group.position.set(5.0, 0, -19.0);

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.5), darkWoodMat);
    base.position.y = 0.04;
    base.castShadow = true;
    group.add(base);

    // Pedestal body (tiered)
    const body1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.38), woodMat);
    body1.position.y = 0.43;
    body1.castShadow = true;
    group.add(body1);

    const body2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.3), darkWoodMat);
    body2.position.y = 0.83;
    body2.castShadow = true;
    group.add(body2);

    // Glass case on top
    const glassCase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.28), glassMat);
    glassCase.position.y = 1.08;
    group.add(glassCase);

    // Document inside (paper with text markings)
    const docMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.95 });
    const doc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.005, 0.22), docMat);
    doc.position.y = 0.88;
    doc.rotation.x = 0.05;
    group.add(doc);

    // Small text lines on document
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.28 - i * 0.02, 0.002, 0.015), inkMat);
      line.position.set(-0.02 + i * 0.01, 0.886, -0.05 + i * 0.035);
      group.add(line);
    }

    // Gold trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.32), goldMat);
    trim.position.y = 0.79;
    group.add(trim);

    // Label stand
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), woodMat);
    label.position.set(0, 0.1, -0.3);
    group.add(label);

    scene.add(group);
    exhibits.push({ id: 'historical_paper_pedestal', position: group.position, radius: 0.7 });
  }

  // 2. TRADITIONAL PAPER DRYING RACK — (6.0, 0, 0.5)
  {
    const group = new THREE.Group();
    group.position.set(6.0, 0, 0.5);

    const frameHeight = 2.0;
    const frameWidth = 2.4;
    const frameDepth = 0.8;

    // Four vertical poles
    for (let dx of [-frameWidth / 2, frameWidth / 2]) {
      for (let dz of [-frameDepth / 2, frameDepth / 2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, frameHeight, 6), bambooMat);
        pole.position.set(dx, frameHeight / 2, dz);
        pole.castShadow = true;
        group.add(pole);
      }
    }

    // Horizontal crossbars at top and bottom
    for (let y of [0.1, frameHeight - 0.1]) {
      for (let dz of [-frameDepth / 2, frameDepth / 2]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, frameWidth, 6), bambooMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, y, dz);
        group.add(bar);
      }
    }

    // Side crossbars
    for (let y of [0.1, frameHeight - 0.1]) {
      for (let dx of [-frameWidth / 2, frameWidth / 2]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, frameDepth, 6), bambooMat);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(dx, y, 0);
        group.add(bar);
      }
    }

    // Internal drying lines (horizontal strings)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const y = 0.35 + i * 0.38;
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, frameWidth - 0.2, 4), lineMat);
      line.rotation.z = Math.PI / 2;
      line.position.set(0, y, 0);
      group.add(line);
    }

    // Paper sheets hanging on lines
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const sheet = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.45, 0.004),
          paperMat
        );
        sheet.position.set(
          -0.7 + col * 0.5,
          0.55 + row * 0.45,
          (row % 2 === 0 ? 0.05 : -0.05)
        );
        sheet.castShadow = true;
        group.add(sheet);
      }
    }

    scene.add(group);
    exhibits.push({ id: 'traditional_paper_drying_rack', position: group.position, radius: 0.8 });
  }

  // 3. PRINTING DISPLAY — (3.0, 0, 14.0)
  {
    const group = new THREE.Group();
    group.position.set(3.0, 0, 14.0);

    // Low table
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.9), woodMat);
    tableTop.position.y = 0.7;
    tableTop.castShadow = true;
    group.add(tableTop);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.66);
    for (let dx of [-0.6, 0.6]) {
      for (let dz of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(dx, 0.33, dz);
        group.add(leg);
      }
    }

    // Carved wood block (printing plate)
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x4a2e15, roughness: 0.85 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), blockMat);
    block.position.set(-0.3, 0.77, -0.1);
    block.rotation.y = 0.15;
    group.add(block);

    // Raised carving lines on block
    const carveMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const carve = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.025), carveMat);
      carve.position.set(-0.3, 0.8, -0.12 + i * 0.06);
      carve.rotation.y = 0.15;
      group.add(carve);
    }

    // Printed paper (placed beside block)
    const printMat = new THREE.MeshStandardMaterial({ color: 0xf5edd6, roughness: 0.9 });
    const printSheet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.005, 0.2), printMat);
    printSheet.position.set(0.1, 0.77, -0.05);
    printSheet.rotation.y = -0.1;
    group.add(printSheet);

    // Ink marks on print
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.9 });
    const mark1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.002, 0.05), inkMat);
    mark1.position.set(0.08, 0.774, -0.02);
    mark1.rotation.y = -0.1;
    group.add(mark1);

    // Ink tray
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.7 });
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.04, 8), trayMat);
    tray.position.set(0.3, 0.74, 0.2);
    group.add(tray);

    // Small ink dish
    const inkDishMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const inkDish = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.02, 8), inkDishMat);
    inkDish.position.set(0.3, 0.75, 0.2);
    group.add(inkDish);

    // Bundle of printed sheets
    for (let i = 0; i < 4; i++) {
      const stackSheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.003, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xf0e6d0 - i * 0x080604, roughness: 0.9 })
      );
      stackSheet.position.set(-0.05, 0.775 + i * 0.004, 0.22);
      stackSheet.rotation.y = 0.05;
      group.add(stackSheet);
    }

    // Label
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.015), woodMat);
    label.position.set(0, 0.72, -0.5);
    group.add(label);

    scene.add(group);
    exhibits.push({ id: 'do_paper_printing_display', position: group.position, radius: 0.8 });
  }

  // 4. VILLAGE DIORAMA — (0, 0, 26.0)
  {
    const group = new THREE.Group();
    group.position.set(0, 0, 26.0);

    // --- Reusable materials ---
    const groundMat2 = new THREE.MeshStandardMaterial({ color: 0x7d8a5a, roughness: 0.95 });
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xb8a88a, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
    const wallDarkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c3a, roughness: 0.9 });
    const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2a, roughness: 0.9 });
    const bambooMat2 = new THREE.MeshStandardMaterial({ color: 0xba9566, roughness: 0.8, metalness: 0.05 });
    const treeMat2 = new THREE.MeshStandardMaterial({ color: 0x4a7744, roughness: 0.9 });
    const trunkMat2 = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const waterMat2 = new THREE.MeshPhysicalMaterial({
      color: 0x5b8db8, transparent: true, opacity: 0.5,
      roughness: 0.1, metalness: 0.2
    });
    const paperMat2 = new THREE.MeshStandardMaterial({ color: 0xf4eedb, roughness: 0.9 });
    const paperIvoryMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9 });
    const markerMat = new THREE.MeshStandardMaterial({ color: 0xc5a059, roughness: 0.4, metalness: 0.3 });
    const markerTextMat = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.9 });
    const jarMat = new THREE.MeshStandardMaterial({ color: 0xa08060, roughness: 0.85 });
    const basketMat = new THREE.MeshStandardMaterial({ color: 0xba8c5a, roughness: 0.9 });
    const fiberMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.95 });
    const figureMat = new THREE.MeshStandardMaterial({ color: 0xcfa87a, roughness: 0.9 });
    const figureDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.85 });
    const firewoodMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.7, metalness: 0.5 });

    // --- Base platform ---
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.8, 0.15, 16),
      woodMat
    );
    base.position.y = 0.075;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Ground surface
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.04, 16),
      groundMat2
    );
    ground.position.y = 0.17;
    group.add(ground);

    // --- Helper: create a house ---
    function makeHouse(x, z, scale, color, hasPorch) {
      const hg = new THREE.Group();
      hg.position.set(x, 0.19, z);
      hg.scale.set(scale, scale, scale);

      const wMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      const walls = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.32), wMat);
      walls.position.y = 0.1;
      walls.castShadow = true;
      hg.add(walls);

      // Roof (pyramid style)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.18, 4), roofTileMat);
      roof.position.y = 0.3;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      hg.add(roof);

      // Porch roof if requested
      if (hasPorch) {
        const porch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.12), roofTileMat);
        porch.position.set(0.26, 0.14, 0);
        porch.rotation.z = -0.15;
        hg.add(porch);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), bambooMat2);
        pillar.position.set(0.26, 0.06, 0);
        hg.add(pillar);
      }

      // Door
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.005), doorMat);
      door.position.set(0, 0.06, 0.165);
      hg.add(door);

      group.add(hg);
      return hg;
    }

    // --- Helper: create a tree ---
    function makeTree(x, z, trunkH, crownR, crownH) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, trunkH, 4), trunkMat2);
      trunk.position.set(x, 0.19 + trunkH / 2, z);
      trunk.castShadow = true;
      group.add(trunk);

      const leaf = new THREE.Mesh(new THREE.ConeGeometry(crownR, crownH, 4), treeMat2);
      leaf.position.set(x, 0.19 + trunkH + crownH / 2 - 0.02, z);
      leaf.castShadow = true;
      group.add(leaf);
    }

    // --- Helper: create a bamboo fence segment ---
    function makeFence(x, z, width, angleY) {
      const fg = new THREE.Group();
      fg.position.set(x, 0.19, z);
      fg.rotation.y = angleY || 0;

      for (let i = 0; i < 3; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), bambooMat2);
        post.position.set(-width / 2 + i * (width / 2), 0.07, 0);
        fg.add(post);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, width, 4), bambooMat2);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.12, 0);
      fg.add(rail);
      const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, width, 4), bambooMat2);
      rail2.rotation.z = Math.PI / 2;
      rail2.position.set(0, 0.05, 0);
      fg.add(rail2);

      group.add(fg);
    }

    // --- Helper: create a zone marker (numbered sign) ---
    function makeMarker(x, z, number, text) {
      const mg = new THREE.Group();
      mg.position.set(x, 0.19, z);

      // Post
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), bambooMat2);
      post.position.set(0, 0.11, 0);
      mg.add(post);

      // Sign board
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.005), markerMat);
      board.position.set(0, 0.23, 0);
      mg.add(board);

      // Number dot
      const num = new THREE.Mesh(new THREE.CircleGeometry(0.012, 6), markerTextMat);
      num.position.set(0, 0.23, 0.006);
      num.rotation.x = 0;
      mg.add(num);

      group.add(mg);
    }

    // --- Helper: create an artisan silhouette ---
    function makeFigure(x, z, height) {
      const fg2 = new THREE.Group();
      fg2.position.set(x, 0.19, z);

      // Body (cone)
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.025, height || 0.14, 4), figureMat);
      body.position.y = (height || 0.14) / 2;
      fg2.add(body);

      // Head (sphere)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), figureDarkMat);
      head.position.y = (height || 0.14) + 0.005;
      fg2.add(head);

      group.add(fg2);
    }

    // --- 1. ZONE A: VILLAGE ENTRANCE + SIGN (front-left) ---
    // Village gate
    const gateGroup = new THREE.Group();
    gateGroup.position.set(-0.55, 0.19, -0.65);

    // Gate posts
    for (let gx of [-0.06, 0.06]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.25, 6), woodMat);
      post.position.set(gx, 0.125, 0);
      gateGroup.add(post);
    }
    // Crossbeam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.02), woodMat);
    beam.position.set(0, 0.26, 0);
    gateGroup.add(beam);
    // Roof over gate
    const gateRoof = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.008, 0.05), roofTileMat);
    gateRoof.position.set(0, 0.275, 0);
    gateRoof.rotation.x = 0.08;
    gateGroup.add(gateRoof);

    group.add(gateGroup);

    // Bamboo fences flanking entrance
    makeFence(-0.68, -0.7, 0.15, 0.2);
    makeFence(-0.42, -0.7, 0.15, -0.2);

    // Entrance path (stone)
    const pathGeo = new THREE.PlaneGeometry(0.08, 0.2);
    for (let i = 0; i < 4; i++) {
      const stone = new THREE.Mesh(pathGeo, pathMat);
      stone.rotation.x = -Math.PI / 2;
      stone.position.set(-0.55 + (i - 1.5) * 0.02, 0.191, -0.5 - i * 0.06);
      group.add(stone);
    }

    // Wooden sign with village name
    const signGroup = new THREE.Group();
    signGroup.position.set(-0.42, 0.19, -0.68);
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4), bambooMat2);
    signPost.position.set(0, 0.09, 0);
    signGroup.add(signPost);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.005), woodMat);
    signBoard.position.set(0, 0.2, 0);
    signGroup.add(signBoard);
    group.add(signGroup);

    // Shade trees near entrance
    makeTree(-0.75, -0.55, 0.18, 0.08, 0.12);
    makeTree(-0.35, -0.55, 0.15, 0.06, 0.1);

    // Bark bundles near gate
    for (let i = 0; i < 3; i++) {
      const bundle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.018, 0.04, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.95 })
      );
      bundle.position.set(-0.48 + i * 0.025, 0.21, -0.6);
      bundle.rotation.x = 0.3;
      group.add(bundle);
    }

    // --- 2. ZONE B: RAW MATERIAL PREPARATION (front-right) ---
    // Roofed workspace
    const workRoof = new THREE.Group();
    workRoof.position.set(0.65, 0.19, -0.55);

    // Four posts
    for (let wx of [-0.12, 0.12]) {
      for (let wz of [-0.08, 0.08]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 4), bambooMat2);
        post.position.set(wx, 0.09, wz);
        workRoof.add(post);
      }
    }
    // Roof
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.2), roofTileMat);
    roofSlab.position.set(0, 0.19, 0);
    roofSlab.rotation.x = 0.05;
    workRoof.add(roofSlab);

    group.add(workRoof);

    // Soaking containers (wooden tubs)
    const tubMat = new THREE.MeshStandardMaterial({ color: 0x5c3e21, roughness: 0.85 });
    for (let i = 0; i < 2; i++) {
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.05, 6), tubMat);
      tub.position.set(0.55 + i * 0.07, 0.215, -0.45);
      group.add(tub);
    }

    // Large ceramic jars
    for (let i = 0; i < 2; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.06, 6), jarMat);
      jar.position.set(0.75, 0.22, -0.5 + i * 0.08);
      group.add(jar);
    }

    // Bamboo baskets
    for (let i = 0; i < 2; i++) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.02, 6), basketMat);
      basket.position.set(0.6 + i * 0.06, 0.2, -0.65);
      group.add(basket);
    }

    // Firewood pile
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 4), firewoodMat);
      log.position.set(0.82, 0.195 + i * 0.005, -0.6 + Math.sin(i) * 0.01);
      log.rotation.z = 0.3;
      log.rotation.y = i * 0.5;
      group.add(log);
    }

    // Artisan figure sorting bark
    makeFigure(0.55, -0.6, 0.12);

    // Bark strips laid out
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.003, 0.002, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 })
      );
      strip.position.set(0.6 + i * 0.015, 0.192, -0.5);
      strip.rotation.y = i * 0.2;
      group.add(strip);
    }

    // --- 3. ZONE C: POUNDING & PULP WORKSHOP (left) ---
    // Open-sided workshop
    const workshop = new THREE.Group();
    workshop.position.set(-0.7, 0.19, 0.2);

    // Four posts for workshop
    for (let wx of [-0.14, 0.14]) {
      for (let wz of [-0.1, 0.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 4), bambooMat2);
        post.position.set(wx, 0.11, wz);
        workshop.add(post);
      }
    }
    // Roof
    const wsRoof = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.24), roofTileMat);
    wsRoof.position.set(0, 0.23, 0);
    wsRoof.rotation.x = 0.03;
    workshop.add(wsRoof);

    group.add(workshop);

    // Mortar (stone)
    const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.06, 6), stoneMat);
    mortar.position.set(-0.7, 0.22, 0.15);
    group.add(mortar);

    // Pounding tool (chày)
    const pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.1, 4), woodMat);
    pestle.position.set(-0.68, 0.28, 0.15);
    pestle.rotation.z = 0.3;
    group.add(pestle);

    // Worktable
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.01, 0.1), woodMat);
    table.position.set(-0.72, 0.195, 0.28);
    group.add(table);
    const tableLegs = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 4), woodMat);
    for (let tx of [-0.06, 0.06]) {
      for (let tz of [-0.04, 0.04]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 4), woodMat);
        leg.position.set(-0.72 + tx, 0.18, 0.28 + tz);
        group.add(leg);
      }
    }

    // Prepared fibers on table
    for (let i = 0; i < 3; i++) {
      const fiber = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), fiberMat);
      fiber.scale.set(2, 0.5, 1);
      fiber.position.set(-0.72 + i * 0.02, 0.2, 0.28);
      fiber.rotation.y = i * 0.3;
      group.add(fiber);
    }

    // Water container
    const wContainer = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.04, 6), jarMat);
    wContainer.position.set(-0.58, 0.21, 0.2);
    group.add(wContainer);

    // Baskets with processed material
    for (let i = 0; i < 2; i++) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.015, 6), basketMat);
      basket.position.set(-0.78 + i * 0.05, 0.198, 0.12);
      group.add(basket);
    }

    // Artisan figure pounding
    makeFigure(-0.65, 0.1, 0.13);

    // --- 4. ZONE D: PAPER-FORMING AREA (right) ---
    // Covered forming area
    const formingRoof = new THREE.Group();
    formingRoof.position.set(0.7, 0.19, 0.3);

    for (let wx of [-0.13, 0.13]) {
      for (let wz of [-0.09, 0.09]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), bambooMat2);
        post.position.set(wx, 0.1, wz);
        formingRoof.add(post);
      }
    }
    const fRoof = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.22), roofTileMat);
    fRoof.position.set(0, 0.21, 0);
    fRoof.rotation.x = -0.03;
    formingRoof.add(fRoof);

    group.add(formingRoof);

    // Paper-forming vat
    const vatMat = new THREE.MeshStandardMaterial({ color: 0x5c3e21, roughness: 0.8 });
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.04, 8), vatMat);
    vat.position.set(0.7, 0.21, 0.25);
    group.add(vat);
    // Water in vat
    const vatWater = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x8ab8d4, transparent: true, opacity: 0.4, roughness: 0.2 })
    );
    vatWater.position.set(0.7, 0.232, 0.25);
    vatWater.rotation.x = -Math.PI / 2;
    group.add(vatWater);

    // Mould frame leaning on vat
    const mouldFrame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.005, 0.04), bambooMat2);
    mouldFrame.position.set(0.75, 0.22, 0.25);
    mouldFrame.rotation.z = 0.4;
    group.add(mouldFrame);

    // Mould rack with unused moulds
    const mouldRack = new THREE.Group();
    mouldRack.position.set(0.62, 0.19, 0.35);
    const rackPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4), bambooMat2);
    rackPost1.position.set(0, 0.03, 0);
    mouldRack.add(rackPost1);
    const rackBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.003, 0.002), bambooMat2);
    rackBar.position.set(0, 0.06, 0);
    mouldRack.add(rackBar);
    group.add(mouldRack);

    // Stack of wet paper sheets
    for (let i = 0; i < 5; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.002, 0.03),
        paperMat2
      );
      sheet.position.set(0.78, 0.192 + i * 0.003, 0.32);
      sheet.rotation.y = i * 0.02;
      group.add(sheet);
    }

    // Pressing boards
    const pressBoard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.035), woodMat);
    pressBoard.position.set(0.78, 0.208, 0.32);
    group.add(pressBoard);

    // Artisan figure at vat
    makeFigure(0.65, 0.2, 0.13);

    // --- 5. ZONE E: PRESSING & DRYING YARD (back) ---
    // Simple paper press (two boards with weight)
    const pressBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.06), woodMat);
    pressBase.position.set(-0.15, 0.193, 0.7);
    group.add(pressBase);

    for (let i = 0; i < 4; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.002, 0.045),
        paperIvoryMat
      );
      sheet.position.set(-0.15, 0.196 + i * 0.003, 0.7);
      group.add(sheet);
    }

    const pressTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.06), woodMat);
    pressTop.position.set(-0.15, 0.21, 0.7);
    group.add(pressTop);

    // Weight stone on press
    const weightStone = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.025), stoneMat);
    weightStone.position.set(-0.15, 0.22, 0.7);
    group.add(weightStone);

    // Bamboo drying rack (E)
    const dryRackE = new THREE.Group();
    dryRackE.position.set(0.15, 0.19, 0.75);
    for (let dx of [-0.04, 0.04]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 4), bambooMat2);
      pole.position.set(dx, 0.08, 0);
      dryRackE.add(pole);
    }
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 4), bambooMat2);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, 0.16, 0);
    dryRackE.add(topBar);
    group.add(dryRackE);

    // Paper sheets hanging on rack
    for (let i = 0; i < 3; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.06, 0.003),
        paperMat2
      );
      sheet.position.set(0.12 + i * 0.025, 0.23, 0.75);
      sheet.castShadow = true;
      group.add(sheet);
    }

    // Sheets drying on flat boards (against a wall)
    const dryWall = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.1, 0.05), bambooMat2);
    dryWall.position.set(0.25, 0.24, 0.6);
    dryWall.rotation.y = -0.3;
    group.add(dryWall);
    for (let i = 0; i < 2; i++) {
      const sheet = new THREE.Mesh(
        new THREE.BoxGeometry(0.001, 0.06, 0.035),
        paperIvoryMat
      );
      sheet.position.set(0.251, 0.23, 0.59 + i * 0.04);
      sheet.rotation.y = -0.3;
      group.add(sheet);
    }

    // Artisan figure at drying yard
    makeFigure(0.0, 0.65, 0.12);

    // --- WATER CHANNEL AND LANDSCAPING ---
    // Pond/water channel (curving between zones)
    const waterMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 8),
      waterMat2
    );
    waterMesh.position.set(0.0, 0.19, -0.2);
    waterMesh.rotation.x = -Math.PI / 2;
    group.add(waterMesh);

    // Small bridge over water
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.06), woodMat);
    bridge.position.set(0.0, 0.205, -0.2);
    group.add(bridge);

    // Stone steps near water
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.005, 0.02), stoneMat);
      step.position.set(0.15, 0.192, -0.15 + i * 0.025);
      group.add(step);
    }

    // Pathways (narrow packed-earth colored strips)
    const paths = [
      { x: -0.55, z: -0.45, w: 0.04, h: 0.3, angle: 0.3 },
      { x: 0.0, z: -0.3, w: 0.05, h: 0.4, angle: 0 },
      { x: -0.4, z: 0.0, w: 0.04, h: 0.3, angle: -0.2 },
      { x: 0.3, z: 0.0, w: 0.04, h: 0.3, angle: 0.2 },
      { x: 0.0, z: 0.4, w: 0.06, h: 0.5, angle: 0 },
    ];
    paths.forEach(p => {
      const path = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w, p.h),
        pathMat
      );
      path.rotation.x = -Math.PI / 2;
      path.position.set(p.x, 0.191, p.z);
      path.rotation.z = p.angle;
      group.add(path);
    });

    // --- BAMBOO FENCES ---
    makeFence(-0.3, -0.3, 0.2, 1.0);
    makeFence(0.4, -0.3, 0.2, -0.8);
    makeFence(-0.5, 0.4, 0.2, 1.2);
    makeFence(0.3, 0.5, 0.2, -1.0);

    // --- ADDITIONAL TREES & PLANTS ---
    makeTree(-0.2, -0.1, 0.12, 0.05, 0.08);
    makeTree(0.1, 0.1, 0.14, 0.06, 0.1);
    makeTree(-0.1, 0.5, 0.16, 0.07, 0.11);
    makeTree(0.5, -0.3, 0.12, 0.05, 0.08);
    makeTree(0.1, -0.5, 0.1, 0.04, 0.07);

    // Banana plants
    const bananaMat = new THREE.MeshStandardMaterial({ color: 0x4a8a44, roughness: 0.9 });
    for (let i = 0; i < 2; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.08, 4), trunkMat2);
      stem.position.set(-0.82 + i * 0.1, 0.23, 0.5 + i * 0.05);
      group.add(stem);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.002, 0.005), bananaMat);
      leaf.position.set(-0.82 + i * 0.1, 0.27, 0.5 + i * 0.05);
      leaf.rotation.x = 1.2;
      leaf.rotation.z = i * 0.3 - 0.3;
      group.add(leaf);
    }

    // --- NUMBERED ZONE MARKERS ---
    makeMarker(-0.55, -0.5, 1, '1');
    makeMarker(0.65, -0.4, 2, '2');
    makeMarker(-0.7, 0.35, 3, '3');
    makeMarker(0.7, 0.45, 4, '4');
    makeMarker(0.0, 0.85, 5, '5');

    // --- GOLD RIM ---
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.02, 8, 24),
      goldMat
    );
    rim.position.y = 0.16;
    rim.rotation.x = Math.PI / 2;
    group.add(rim);

    // --- TITLE PLATE ---
    const plateMat2 = new THREE.MeshStandardMaterial({ color: 0xc5a059, roughness: 0.4, metalness: 0.5 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.015), plateMat2);
    plate.position.set(0, 0.195, 1.1);
    group.add(plate);

    scene.add(group);
    exhibits.push({ id: 'yen_thai_village_diorama', position: group.position, radius: 1.2 });
  }

  return exhibits;
}
